import {BaseMonitorData, IReporter, WebEyeConfig} from "../types";
import {getPageVisibility, safeJsonStringify, sleep} from "../utils/common";

/**
 * 数据上报器
 * */
export class Reporter implements IReporter {
    private config: WebEyeConfig;
    private queue: BaseMonitorData[] = [];
    private timer: NodeJS.Timeout | null = null;
    private isReporting = false;

    constructor(config: WebEyeConfig) {
        this.config = config;
        this.startBatchTimer();
        this.bindBeforeUnload();
    }

    /**
     * 上报数据
     * */
    async report(data: BaseMonitorData | BaseMonitorData[]): Promise<void> {
        const items = Array.isArray(data) ? data: [data];

        if (this.config.enableAutoReport) {
            this.queue.push(...items);

            if (this.queue.length >= (this.config.batchSize || 10)) {
                await this.flush();
            }
        } else {
            await this.sendData(items);
        }
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

        let retryCount = 0;
        const maxRetry = this.config.maxRetry || 3;
        const retryDelay = this.config.retryDelay || 1000;

        while (retryCount < maxRetry) {
            try {
                const success = await this.sendRequest(data);

                if (success) {
                    this.isReporting = false;
                    return;
                }
                retryCount++;
                if (retryCount < maxRetry) {
                    await sleep(retryDelay * retryCount);
                }
            } catch (error) {
                console.error('Report error: ', error);
                retryCount++;
                if (retryCount < maxRetry) {
                    await sleep(retryDelay * retryCount);
                }
            }
        }

        // 重试失败，将数据重新加入队列
        console.error('Failed to report data after retries');
        this.queue.unshift(...data);
        this.isReporting = false;
    }

    /**
     * 发送 HTTP 请求
     * */
    private async sendRequest(data: BaseMonitorData[]): Promise<boolean> {
        try {
            // 尝试使用 sendBeacon API 发送数据
            if (navigator.sendBeacon && data.length < 5) {
                const success = navigator.sendBeacon(
                    this.config.reportUrl,
                    safeJsonStringify(data),
                )

                if (success) return true;
            }

            // 使用 fetch API 发送数据
            const request = await fetch(this.config.reportUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: safeJsonStringify(data),
                keepalive: true,
            })

            return request.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 使用图片请求发送数据（兜底方案）
     * */
    private sendByImage(data: BaseMonitorData[]): Promise<boolean> {
        return new Promise(resolve => {
            const image = new Image();
            const timeout = setTimeout(() => {
                resolve(false);
            }, 10000);

            image.onload = image.onerror = () => {
                clearTimeout(timeout);
                resolve(true);
            }

            const params = new URLSearchParams({
                data: safeJsonStringify(data),
            })

            image.src = `${this.config.reportUrl}?${params.toString()}`
        })
    }

    /**
     * 启动批量上报定时器
     * */
    private startBatchTimer(): void {
        if (!this.config.enableAutoReport) return;

        const interval = this.config.flushInterval || 10000; // 默认 10s

        this.timer = setInterval(() => {
            this.flush();
        }, interval);
    }

    /**
     * 绑定页面卸载事件
     * */
    private bindBeforeUnload(): void {
        // 页面卸载前发送剩余数据
        window.addEventListener('beforeunload', () => {
            if (this.queue.length > 0) {
                // 使用 sendBeacon 或同步请求发送数据
                navigator.sendBeacon(
                    this.config.reportUrl,
                    safeJsonStringify(this.queue),
                )
            }
        })

        // 页面隐藏时发送数据
        document.addEventListener('visibilitychange', () => {
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

        // 发送剩余的数据
        if (this.queue.length > 0) {
            this.flush();
        }
    }
}














































