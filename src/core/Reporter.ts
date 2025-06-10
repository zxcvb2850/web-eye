import {BaseMonitorData, IReporter, WebEyeConfig} from "../types";
import {getPageVisibility, safeJsonStringify, sleep} from "../utils/common";
import {Logger} from "./Logger";
import {strToU8, gzipSync} from "fflate";

/**
 * 数据上报器
 * */
export class Reporter implements IReporter {
    private config: WebEyeConfig;
    private logger: Logger;
    private queue: BaseMonitorData[] = [];
    private timer: NodeJS.Timeout | null = null;
    private isReporting = false;

    // sendBeacon 数据大小限制（通常为64KB）
    private readonly BEACON_SIZE_LIMIT = 64 * 1024;
    // 压缩阈值，超过此大小才进行压缩
    private readonly COMPRESS_THRESHOLD = 1024;

    constructor(config: WebEyeConfig) {
        this.config = config;
        this.logger = new Logger(this.config);
        this.bindBeforeUnload();
    }

    /**
     * 上报数据
     * */
    async report(data: BaseMonitorData | BaseMonitorData[]): Promise<void> {
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
                this.logger.error('Report error: ', error);
                retryCount++;
                if (retryCount < maxRetry) {
                    await sleep(retryDelay * retryCount);
                }
            }
        }

        // 重试失败，将数据重新加入队列
        this.logger.error(`Failed to report data ====> ${retryCount}`);
        this.queue.unshift(...data);
        this.isReporting = false;
    }

    /**
     * 压缩数据
     * */
    private compressData(data: string): { compressed: Uint8Array, isCompressed: boolean } {
        try {
            // 检查是否需要压缩数据
            if (data.length < this.COMPRESS_THRESHOLD) {
                return {
                    compressed: strToU8(data),
                    isCompressed: false,
                }
            }

            // gzip 压缩数据
            const compressed = gzipSync(strToU8(data));

            // 如果压缩后的数据比原始更大，则使用原始数据进行上报
            if (compressed.length > data.length) {
                return {
                    compressed: strToU8(data),
                    isCompressed: false,
                }
            }

            return {
                compressed,
                isCompressed: true,
            }
        } catch (error) {
            console.error(`Failed to compress data ====> ${error}`);
            return {
                compressed: strToU8(data),
                isCompressed: false,
            }
        }
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
    private async sendRequest(data: BaseMonitorData[]): Promise<boolean> {
        try {
            const jsonData = safeJsonStringify(data);
            const { compressed, isCompressed } = this.compressData(jsonData);

            // 如果数据量过大，则使用分批发送
            if (compressed.length > this.BEACON_SIZE_LIMIT * 2) {
                this.logger.log('Large data detected, sending in batches');
                return false;
            }

            // 尝试使用 sendBeacon API 发送数据
            if (this.canUseSendBeacon(compressed.length, data.length)) {
                const blob = new Blob([compressed], {
                    type: isCompressed ? 'application/gzip' : 'application/json',
                });

                const success = navigator.sendBeacon(`${this.config.reportUrl}/beacon`, blob);
                if (success) {
                    return true
                }
            }

            // 使用 fetch API 发送数据
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'EyeLogTag': '1', // 标记为内部请求
            }
            if (isCompressed) {
                headers['Content-Encoding'] = 'gzip';
            }
            const request = await fetch(`${this.config.reportUrl}/fetch`, {
                method: 'POST',
                headers,
                body: compressed,
                keepalive: true,
            })
            return request.ok;
        } catch (error) {
            this.logger.error('Send batch error ====> ', error);
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

                // 对于图片请求，数据通过URL参数传递，有长度限制
                // 这里只发送精简的数据
                const simplifiedData = data.map(item => ({
                    type: item.type,
                    data: safeJsonStringify(item.data),
                }));

                const params = new URLSearchParams({
                    data: safeJsonStringify(simplifiedData),
                });

                const url = `${this.config.reportUrl}/img?${params.toString()}`;

                // 检查URL长度限制
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
     * 绑定页面卸载事件
     * */
    private bindBeforeUnload(): void {
        // 页面卸载前发送剩余数据
        window.addEventListener('beforeunload', () => {
            if (this.queue.length > 0) {
                this.sendRequest(this.queue);
                // 使用 sendBeacon 或同步请求发送数据
                /*navigator.sendBeacon(
                    this.config.reportUrl,
                    safeJsonStringify(this.queue),
                )*/
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














































