import { strToU8 } from "fflate";
import { BaseMonitorData, IReporter, WebEyeConfig } from "../types";
import { getPageVisibility, safeJsonStringify, sleep, compressData } from "../utils/common";
import { addEventListener } from "../utils/helpers";
import { Logger } from "./Logger";
import { IndexedDBManager } from "../utils/indexedDBManager";

/**
 * 数据上报器
 * */
export class Reporter implements IReporter {
    private config: WebEyeConfig;
    private logger: Logger;
    private queue: BaseMonitorData[] = [];
    private timer: NodeJS.Timeout | null = null;
    private isReporting = false;
    private db: IndexedDBManager | null = null;
    private readonly dbStoreName = "report_fails";

    // sendBeacon 数据大小限制（通常为64KB）
    private readonly BEACON_SIZE_LIMIT = 64 * 1024;
    // 压缩阈值，超过此大小才进行压缩
    private readonly COMPRESS_THRESHOLD = 1024;

    constructor(
        config: WebEyeConfig,
        logger: Logger
    ) {
        this.config = config;
        this.logger = logger;
        this.bindBeforeUnload();
        this.init();
    }

    async init() {
        this.db = new IndexedDBManager()

        // 启动时重试之前的失败的日志
        await this.retryFailedLogs();
    }

    /**
     * 上报数据
     * */
    async report(data: BaseMonitorData[]): Promise<void> {
        const items = Array.isArray(data) ? data: [data];

        await this.sendData(items);
    }

    /**
     * 刷新队列，发送所有数据
     * */
    async flush(): Promise<void> {
        if (this.queue.length === 0 || this.isReporting) return;

        const dataToSend = [...this.queue];
        this.queue = [];

        await this.sendData(dataToSend);
    }

    /**
     * 发送数据到服务器
     * */
    private async sendData(data: BaseMonitorData[]): Promise<void> {
        if (data.length === 0) return;

        this.isReporting = true;

        try {
            const success = await this.sendRequest(data);
            if (success) {
                this.isReporting = false;
                return;
            }
        } catch (error) {
            this.logger.error('Report error: ', error);
        }

        // 上报失败，将数据存入 indexedDB
        this.logger.error(`Failed to report data, caching to IndexedDB.`);
        for (const item of data) {
            // @ts-ignore
            await this.addFailedLog({ ...item, retryCount: 0, status: 'pending', updateAt: Date.now() });
        }
        this.isReporting = false;
    }

    /**
     * 检查数据是否适合使用 sendBeacon
     * */
    private canUseSendBeacon(dataSize: number, dataLength: number): boolean {
        // 检查浏览器支持
        if (!navigator.sendBeacon) {
            return false;
        }

        // 检查数据大小限制
        if (dataSize > this.BEACON_SIZE_LIMIT) {
            return false;
        }

        // 检查数据条数限制（可根据实际情况调整）
        if (dataLength > 10) {
            return false;
        }

        return true;
    }

    /**
     * 发送 HTTP 请求
     * */
    private async sendRequest(data: BaseMonitorData[], id?: IDBValidKey | undefined): Promise<boolean> {
        try {
            const jsonData = safeJsonStringify(data);
            let compressed = strToU8(jsonData);
            let isCompressed = false;
            // 检查是否需要压缩数据
            if (jsonData.length < this.COMPRESS_THRESHOLD) {
            } else {
                const data = compressData(jsonData);
                compressed = data.compressed;
                isCompressed = data.isCompressed;
            }
            let isMaxBody = false;
            // 如果数据量过大，则使用分批发送
            if (compressed.length > this.BEACON_SIZE_LIMIT) {
                this.logger.log('Large data detected, sending in batches');
                isMaxBody = true;
            }

            // 尝试使用 sendBeacon API 发送数据
            if (this.canUseSendBeacon(compressed.length, data.length)) {
                const blob = new Blob([compressed], {
                    type: isCompressed ? 'application/gzip' : 'application/json',
                });

                const success = navigator.sendBeacon(`${this.config.reportUrl}/beacon`, blob);
                if (success) {
                    if (id) {
                        await this.db?.delete(this.dbStoreName, id);
                    }
                    return true
                }
            }

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
            const request = await fetch(`${this.config.reportUrl}/fetch`, {
                method: 'POST',
                headers,
                body,
                keepalive: !isMaxBody,
            })
            if (request.ok) {
                this.logger?.log?.(`report log success: ${data.length}`);
                // 上报成功，清理日志
                if (id) {
                    await this.db?.delete(this.dbStoreName, id);
                }
                return true;
            } else {
                this.logger.error(`上报失败： ${request.status} ${request.statusText}`);
                if (id) {
                    const logFromDb = data[0] as any;
                    const newRetryCount = (logFromDb.retryCount || 0) + 1;
                    const maxRetry = this.config.maxRetry || 3;

                    if (newRetryCount >= maxRetry) {
                        this.logger.warn(`Log reached max retries (${maxRetry}). Deleting from cache.`, logFromDb);
                        await this.db?.delete(this.dbStoreName, id);
                    } else {
                        // @ts-ignore
                        const updatedLog = { ...logFromDb, retryCount: newRetryCount, updateAt: Date.now(), status: 'failed' };
                        await this.db?.put(this.dbStoreName, id, updatedLog);
                    }
                }
                return false
            }
        } catch (error) {
            this.logger.error('Send batch error ====> ', error);
            if (id) {
                try {
                    const logFromDb = data[0] as any;
                    const newRetryCount = (logFromDb.retryCount || 0) + 1;
                    const maxRetry = this.config.maxRetry || 3;
                    if (newRetryCount >= maxRetry) {
                        await this.db?.delete(this.dbStoreName, id);
                    } else {
                        // @ts-ignore
                        const updatedLog = { ...logFromDb, retryCount: newRetryCount, updateAt: Date.now(), status: 'failed' };
                        await this.db?.put(this.dbStoreName, id, updatedLog);
                    }
                } catch (dbError) {
                    this.logger.error('Failed to update log in DB after send error:', dbError);
                }
            }
            return false;
        }
    }

    /**
     * 使用图片请求发送数据（兜底方案）
     * */
    private sendByImage(data: BaseMonitorData[]): Promise<boolean> {
        return new Promise(resolve => {
            try {
                const image = new Image();
                const timeout = setTimeout(() => {
                    resolve(false);
                }, 10000);

                image.onload = image.onerror = () => {
                    clearTimeout(timeout);
                    resolve(true);
                }

                const simplifiedData = data.map(item => ({
                    type: item.type,
                    data: safeJsonStringify(item.data),
                }));

                const params = new URLSearchParams({
                    data: safeJsonStringify(simplifiedData),
                });

                const url = `${this.config.reportUrl}/img?${params.toString()}`;

                if (url.length > 2000) {
                    this.logger.warn('Image request URL too long, skipping');
                    resolve(false);
                    return;
                }

                image.src = url;
            } catch (error) {
                this.logger.error('SendByImage error:', error);
                resolve(false);
            }
        });
    }

    /**
     * */
    private async retryFailedLogs(): Promise<void> {
        if (!this.db?.loaded) {
            return
        }
        try {
            const pendingLogs = await this.db?.getAll<any>(this.dbStoreName);

            if (!pendingLogs || pendingLogs.length === 0) return;

            const maxRetry = this.config.maxRetry || 3;

            for (const log of pendingLogs) {
                if (!log || !log.id) continue;

                if (log.status === "success" || (log.retryCount && log.retryCount >= maxRetry)) {
                    await this.db?.delete(this.dbStoreName, log.id);
                } else {
                    // @ts-ignore
                    await this.sendRequest([log], log.id);
                }

                await sleep(100);
            }
        } catch (error) {
            this.logger?.error?.("Failed to retry failed logs:", error);
        }
    }

    private async addFailedLog(item: any): Promise<void> {
        if (!this.db?.loaded) {
            this.logger.warn("DB not ready, cannot cache failed log.");
            return;
        }
        try {
            const allLogs = await this.db.getAll<any>(this.dbStoreName);
            if (allLogs && allLogs.length >= 50) {
                this.logger.warn("IndexedDB cache is full (50 items). Removing oldest log.");
                allLogs.sort((a, b) => a.updateAt - b.updateAt);
                const oldestLog = allLogs[0];
                if (oldestLog.id) {
                    await this.db.delete(this.dbStoreName, oldestLog.id);
                }
            }
            await this.db.add(this.dbStoreName, item);
        } catch (error) {
            this.logger.error('Failed to add log to indexedDB:', error);
        }
    }

    /**
     * 绑定页面卸载事件
     * */
    private bindBeforeUnload(): void {
        // 页面卸载前发送剩余数据
        addEventListener(window, 'beforeunload', () => {
            if (this.queue.length > 0) {
                this.sendRequest(this.queue);
            }
        })

        // 页面隐藏时发送数据
        addEventListener(document,'visibilitychange', () => {
            if (getPageVisibility() === "hidden" && this.queue.length > 0) {
                this.flush();
            }
        })
    }

    /**
     * 销毁上报器
     * */
    destroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (this.queue.length > 0) {
            this.flush();
        }
    }
}
