import { IndexedDBManager } from "../utils/indexedDBManager";
import { sleep } from "../utils/common";

interface WorkerMessage {
    type: "init" | "log" | "flush";
    data?: any;
}

type LogStatus = 'pending' | 'success' | 'failed';

export interface StoredLogEntry {
    retryCount: number;
    status: LogStatus;
    createdAt: number;
    updateAt?: number;
    [key: string]: any;
}

export interface WorkerResponse {
    type: "ready" | "error";
    data?: any;
}

class LogWorker {
    private config = {
        workerUrl: '',
        serverUrl: '',
        maxRetries: 3,
        maxLogs: 200,
        retryInterval: 30000,
    }

    private db: IndexedDBManager | null = null;
    private retryTimer: number | null = null;
    private readonly dbStoreName  = "reports"

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        try {
            this.startRetryTimer();
            this.postMessage("ready", null);

            // 启动时重试之前上报失败的日志
            await this.retryFailedLogs();
        } catch (err) {
            this.postMessage("error", err instanceof Error ? err.message : String(err));
        }
    }

    private handleMessage(event: MessageEvent<WorkerMessage>): void {
        const { type, data, ...other } = event.data;
        console.info("Worker handleMessage: ", type, data, other);

        switch (type) {
            case "init":
                console.info("init");
                break;
            case "log":
                if (data) {
                    this.saveLog(data);
                }
                break;
            case "flush":
                this.flushLogs();
                break;
        }
    }

    // 保存日志并尝试上报
    private async saveLog(data: any): Promise<void> {
        try {
            // 添加额外字段
            const logData: StoredLogEntry = {
                ...data,
                retryCount: 0,
                status: "pending",
                createdAt: Date.now(),
            };

            // 保存到 IndexedDB
            const dbValid = await this.db?.add(this.dbStoreName, logData);
            if (!dbValid) {
                throw new Error("日志保存失败");
            }
            // 立即尝试上报
            await this.reportLog(logData, logData.id);

            // 清空旧日志
            await this.cleanupOldLogs();
        } catch (err) {
            console.info("保存日志失败 ：" , err);
        }
    }

    // 上报日志
    private async reportLog(data: StoredLogEntry, id: string): Promise<void> {
        try {
            const response = await fetch(this.config.serverUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
                // 添加超时控制
                signal: AbortSignal.timeout(3000),
            });

            if (response.ok) {
                // 上报成功，更新状态
                await this.db?.put(this.dbStoreName, { id, status: "success", updateAt: Date.now() });
            } else {
                throw new Error(`上报失败: ${response.status} ${response.statusText}` );
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.info('日志上报失败:', errorMessage);
            // 上报失败，增加重试次数
            await this.db?.put(this.dbStoreName, { id, status: "failed", retryCount: data.retryCount + 1, updateAt: Date.now() });
        }
    }

    // 获取待重试的日志列表
    private async getPendingLogs(): Promise<StoredLogEntry[] | undefined> {
        const result = await this.db?.getAll<StoredLogEntry>(this.dbStoreName, "status", "pending");
        console.info("getPendingLogs", result);
        return result
    }

    // 重试失败的日志
    private async retryFailedLogs(): Promise<void> {
        try {
            const pendingLogs = await this.getPendingLogs();

            if (!pendingLogs) return;

            for (const log of pendingLogs) {
                await this.reportLog(log, log.id);
                // 避免并发请求过多，稍作延迟
                await sleep(100);
            }
        } catch (err) {
            console.info("日志重试失败：", err);
        }
    }

    // 启动定时重试
    private startRetryTimer(): void {
        this.retryTimer = self.setInterval(async () => {
            await this.retryFailedLogs();
        }, this.config.retryInterval);
    }

    // 清理旧日志，保留最新的自定数量
    private async cleanupOldLogs(): Promise<void> {
        try {
            const result: StoredLogEntry[] | undefined = await this.db?.getAll(this.dbStoreName, "timestamp");
            if (!result) return;

            // 按照时间倒叙排列
            result.sort((a, b) => b.timestamp - a.timestamp);

            // 删除超过最大数量的日志
            if (result.length > this.config.maxLogs) {
                const logsToDelete = result.slice(this.config.maxLogs);
                logsToDelete.forEach(log => this.db?.delete(this.dbStoreName, log.id))
            }
        } catch (err) {
            console.info('清理旧日志失败:', err);
        }
    }

    // 强制刷新所有待上报的日志
    private async flushLogs(): Promise<void> {
        await this.retryFailedLogs();
    }

    // 发送消息
    private postMessage(type: WorkerResponse['type'], data: any): void {
        self.postMessage({ type, data } as WorkerResponse);
    }

    // 销毁清理资源
    public destroy(): void {
        if (this.retryTimer) {
            self.clearInterval(this.retryTimer);
            this.retryTimer = null;
        }
    }
}