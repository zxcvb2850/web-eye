import { Logger } from "../core/Logger";
import { IndexedDBManager } from "../utils/indexedDBManager";
import { WebEyeConfig, BaseMonitorData } from "../types";
import { sleep, safeJsonStringify, compressData } from "../utils/common"

export type LogStatus = "pending" | "success" | "failed";

export interface WorkerConfig {
    maxRetry: number;
    retryDelay: number;
}

type WorkerAndWebEyeConfig = WebEyeConfig & WorkerConfig;

export interface StoredLogEntry extends BaseMonitorData {
    retryCount: number;
    status: LogStatus;
    createAt: number;
    updateAt?: number;
}

export interface WorkerMessage {
    type: "init" | "log" | "flush";
    data?: any;
}

export interface WorkerResponse {
    type: "ready" | "error";
    data?: any;
}

class MainWorker {
    private config: WorkerConfig = {
        maxRetry: 3,
        retryDelay: 60000,
    };
    private globalConfig: WorkerAndWebEyeConfig | null = null;
    private logger: Logger | null = null;
    private db: IndexedDBManager | null = null;
    private retryTimer: number | null = null;
    private readonly dbStoreName = "workers";
    private retryDBCount = 0; // 刚启动时重试indexedDB状态次数

    constructor() {
        // 初始化数据库
        this.db = new IndexedDBManager();
    }

    private async init(config: WorkerAndWebEyeConfig): Promise<void> {
        this.globalConfig = {...this.config, ...config};
        this.logger = new Logger(config);

        this.logger.log("Init Worker");

        try {
            // 定时重启上报日志
            // this.startRetryTimer();
            this.postMessage("ready", null);

            // 启动时重试之前的失败的日志
            await this.retryFailedLogs();
        } catch (error) {
            this.logger.error("Failed to initialize ConsolePlugin:", error);
        }
    }

    public handleMessage(event: MessageEvent<WorkerMessage>) {
        const { type, data } = event.data;
        switch (type) {
            case "init":
                this.init(data);
                break;
            case "log":
                this.saveLog(data);
                break;
            case "flush":
                this.flushLogs();
                break;
            default:
                break;
        }
    }

    // 保存日志并尝试上报
    private async saveLog(logEntry: BaseMonitorData): Promise<void> {
        if (!this.db?.loaded) return;

        try {
            // 添加额外字段
            const logData: StoredLogEntry = {
                ...logEntry,
                retryCount: 0,
                status: "pending",
                createAt: Date.now(),
            };

            // 立即上报
            await this.reportLog(logData);

            // 清理旧日志
            await this.cleanupOldLogs();
        } catch (error) {
            this.logger?.error?.("Failed to save log: ", error);
        }
    }

    // 上报日志
    private async reportLog(data: StoredLogEntry, id?: IDBValidKey | undefined): Promise<void> {
        console.info("worker reportLog", data, this.db?.loaded || false, this.globalConfig?.reportUrl || false);
        if (!this.db?.loaded) return;
        if (!this.globalConfig?.reportUrl) return;

        try {
            const {id, ...rest} = data;
            const jsonData = safeJsonStringify(rest);
            const {compressed, isCompressed} = compressData(jsonData);
            // 使用 fetch API 发送数据
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'EyeLogTag': '1', // 标记为内部请求
            }
            let body: string|Blob = jsonData;
            if (isCompressed) {
                headers['Content-Encoding'] = 'gzip';
                headers['Content-Type'] = 'application/gzip';
                body = new Blob([compressed], {
                    type: isCompressed ? 'application/gzip' : 'application/json',
                });
            }
            const response = await fetch(`${this.globalConfig.reportUrl}/w`, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout(10000), // 10s 超时
            })

            if (response.ok) {
                // 上报成功，清理日志
                id && await this.db?.delete(this.dbStoreName, id);
            } else  {
                throw new Error(`上报失败： ${response.status} ${response.statusText}`);
            }
        } catch(error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger?.error?.("Failed to report log:", errorMessage);

            if (id) {
                // 存在则更新
                await this.db?.put(this.dbStoreName, id, {
                    status: "failed",
                    retryCount: data.retryCount + 1,
                    updateAt: Date.now()
                });
            } else {
                // 不能存在则保存
                await this.db?.add(this.dbStoreName, data);
            }
        }
    }

    // 重试失败的日志
    private async retryFailedLogs(): Promise<void> {
        if (!this.db?.loaded) {
            // 尝试再次重试, 最多重试 5 次
            if (this.retryDBCount > 5) return
            // 首次加载完成，db 尚未加载完成，所以尝试再次重试
            self.setTimeout(() => {
                this.retryDBCount += 1;
                this.retryFailedLogs();
            }, 2000);
            return
        }
        try {
            const pendingLogs = await this.db?.getAll<StoredLogEntry>(this.dbStoreName, "status");

            if (!pendingLogs || pendingLogs.length === 0) return;
            for (const log of pendingLogs) {
                if (log.status === "success" || log.retryCount >= this.config?.maxRetry) {
                    // 删除已成功的日志和已达到最大重试次数的日志
                    await this.db?.delete(this.dbStoreName, log.id);
                } else {
                    // 重试失败的日志
                    await this.reportLog(log, log.id);
                }

                // 避免并发请求过多，稍作延迟
                await sleep(1000);
            }
        } catch (error) {
            this.logger?.error?.("Failed to retry failed logs:", error);
        }
    }

    // 启动定时重试
    private startRetryTimer(): void {
        this.retryTimer = self.setInterval(async () => {
            await this.retryFailedLogs();
        }, this.config.retryDelay);
    }

    // 清理旧日志，保留最新的指定数量条
    private async cleanupOldLogs(): Promise<void> {
        try {

        } catch (error) {
            this.logger?.error?.("Failed to cleanup old logs:", error);
        }
    }

    private async flushLogs(): Promise<void> {
        await this.retryFailedLogs();
    }

    private postMessage(type: WorkerResponse["type"], data: any):void {
        self.postMessage({type: data} as WorkerResponse);
    }

    private destory():void {
        if (this.retryTimer) {
            clearInterval(this.retryTimer);
            this.retryTimer = null;
        }
    }
}

declare const self: DedicatedWorkerGlobalScope;
if (typeof self !== "undefined") {
    const mainWorker = new MainWorker();
    self.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
        mainWorker.handleMessage(event);
    });
}
