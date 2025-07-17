import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import { generateId, safeJsonStringify } from "../utils/common";
import { addEventListener } from "../utils/helpers";
import { record } from 'rrweb';
import { listenerHandler, EventType, eventWithTime, SamplingStrategy } from "@rrweb/types";
import { recordOptions } from "rrweb/typings/types";

/**
 * 录制事件类型
 */
export enum RecordTriggerType {
    MANUAL = 'manual',      // 手动触发
    ERROR = 'error',        // 错误触发
    CUSTOM = 'custom'       // 自定义触发
}

// 会话状态
interface SessionState {
    sessionId: string;
    errorId?: string | null;
    triggerType: RecordTriggerType;
    startTime: number;
    lastFullSnapshot: eventWithTime | null;
    events: eventWithTime[];
    isReporting: boolean;
    reportTimer: NodeJS.Timeout | null;
}

// 缓存数据结构
interface CacheData {
    sessionId: string;
    errorId?: string | null;
    events: eventWithTime[];
    triggerType: RecordTriggerType;
    metadata: {
        startTime: number;
        endTime: number;
        url: string;
        userAgent: string;
    };
    timestamp: number;
}

interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

// 上报数据接口
interface ReportData {
    id: string;
    errorId?: string | null;
    events: eventWithTime[];
    triggerType: RecordTriggerType;
    metadata: {
        startTime: number;
        endTime: number;
        duration: number;
        eventCount: number;
        url: string;
        userAgent: string;
        triggerReason: 'manual' | 'beforeunload' | 'cache_restore';
    };
    compressed?: boolean;
    size: number;
}

// 配置接口
interface RecordConfig {
    // 延迟上报时间（毫秒）
    delayReportTime?: number;
    // 最大缓存事件数量
    maxCacheEvents?: number;
    // 最大上报大小（字节）
    maxReportSize?: number;
    // 缓存本地存储key前缀
    cacheKeyPrefix?: string;
    // 性能配置
    performance?: {
        // 事件采样配置
        sampling?: SamplingStrategy;
        // 内存清理间隔（毫秒）
        memoryCleanInterval?: number;
        // 最大内存使用阈值（MB）
        maxMemoryUsage?: number;
    };
    // 隐私配置
    privacy?: {
        ignoreClass?: string;
        blockClass?: string;
        maskAllInputs?: boolean;
        maskInputOptions?: Record<string, boolean>;
    };
}

/**
 * rrweb 录制插件
 * */
export class RecordPlugin extends Plugin {
    name = 'RecordPlugin';
    private stopRecording: listenerHandler | null | undefined = null;
    private session: SessionState;
    private memoryCleanTimer: NodeJS.Timeout | null = null;
    private isInitialized = false;

    private readonly config: RecordConfig = {
        delayReportTime: 3000,
        maxCacheEvents: 1000,
        maxReportSize: 2 * 1024 * 1024, // 5MB
        cacheKeyPrefix: 'webeye_rr_cache_',
        performance: {
            sampling: {
                scroll: 400,
                mousemove: 600,
                mouseInteraction: true,
                input: 'last',
                canvas: 60,
            },
            memoryCleanInterval: 30000, // 30秒
            maxMemoryUsage: 200 // 200MB
        },
        privacy: {
            ignoreClass: 'rr-ignore',
            blockClass: 'rr-block',
            maskAllInputs: true,
            maskInputOptions: {
                color: true,
                date: true,
                email: true,
                password: true,
                tel: true,
                text: true,
                textarea: true
            }
        },
    };

    constructor(config?: Partial<RecordConfig>) {
        super();
        this.config = { ...this.config, ...config };

        this.session = this.createNewSession();
    }

    protected async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // 检查并恢复缓存的录制数据
            await this.restoreCachedRecordings();

            // 开始自动录制
            this.startContinuousRecording();

            // 设置页面卸载监听
            this.setupBeforeUnloadHandler();

            // 启动内存清理
            this.startMemoryCleanup();

            this.isInitialized = true;
            this.logger.log('Init RecordPlugin');
        } catch (error) {
            this.logger.error('Failed to initialize RecordPlugin:', error);
        }
    }

    protected destroy(): void {
        if (this.stopRecording) {
            this.stopRecording();
            this.stopRecording = null;
        }

        if (this.session.reportTimer) {
            clearTimeout(this.session.reportTimer);
        }

        if (this.memoryCleanTimer) {
            clearInterval(this.memoryCleanTimer);
        }

        this.logger.log('录制器已销毁');
    }

    // 创建新会话
    private createNewSession(): SessionState {
        return {
            sessionId: generateId(),
            triggerType: RecordTriggerType.MANUAL,
            startTime: Date.now(),
            lastFullSnapshot: null,
            events: [],
            isReporting: false,
            reportTimer: null
        };
    }

    // 开始持续录制
    private startContinuousRecording(): void {
        if (this.stopRecording) {
            this.stopRecording();
        }

        const options: recordOptions<eventWithTime> = {
            emit: (event: eventWithTime) => {
                this.handleEvent(event);
            },
            ...this.config.privacy,
            collectFonts: false,
            recordCanvas: false,
            recordCrossOriginIframes: false,
        }
        this.config.performance?.sampling && (options.sampling = this.config.performance.sampling)

        this.stopRecording = record(options);

        this.logger.log('开始持续录制，会话ID:', this.session.sessionId);
    }

    // 处理录制事件
    private handleEvent(event: eventWithTime): void {
        try {
            // 保存完整快照引用
            if (event.type === EventType.FullSnapshot) {
                this.session.lastFullSnapshot = event;
            }

            // 添加事件到缓存
            this.session.events.push(event);

            // 检查内存使用
            this.checkMemoryUsage();

            // 保持事件数量在限制范围内
            if (this.config.maxCacheEvents && this.session.events.length > this.config.maxCacheEvents) {
                this.trimEvents();
            }
        } catch (error) {
            // this.config.onError(error as Error);
            this.logger.error("handleEvent error", error);
        }
    }

    public customTrigger(errorId?: string): string | null {
        this.session.triggerType = RecordTriggerType.CUSTOM;
        errorId && (this.session.errorId = errorId);

        // 设置延迟上报定时器
        this.session.reportTimer = setTimeout(() => {
            this.executeReport('manual');
        }, this.config.delayReportTime);

        return this.session.sessionId;
    }

    // 触发上报
    public errorTrigger(errorId: string): string | null {
        if (this.session.isReporting) {
            this.logger.log('正在上报中，忽略重复触发');
            return null;
        }

        this.session.isReporting = true;
        this.session.triggerType = RecordTriggerType.ERROR;
        this.session.errorId = errorId;
        this.logger.log(`触发上报，将在 ${this.config.delayReportTime}ms 后执行`);

        // 设置延迟上报定时器
        this.session.reportTimer = setTimeout(() => {
            this.executeReport('manual');
        }, this.config.delayReportTime);

        return this.session.sessionId;
    }

    // 取消上报
    public cancelReport(): void {
        if (this.session.reportTimer) {
            clearTimeout(this.session.reportTimer);
            this.session.reportTimer = null;
            this.session.isReporting = false;
            this.logger.log('取消上报');
        }
    }

    // 执行上报
    private async executeReport(triggerReason: 'manual' | 'beforeunload' | 'cache_restore'): Promise<void> {
        try {
            const reportData = this.prepareReportData(triggerReason);

            // 检查上报大小
            if (this.config.maxReportSize && reportData.size > this.config.maxReportSize) {
                this.logger.warn('上报数据过大，进行压缩处理');
                await this.compressReportData(reportData);
            }

            await this.report({
                type: MonitorType.RECORD,
                data: {...reportData, events: safeJsonStringify(reportData.events)}
            });

            this.logger.log(`上报完成，会话ID: ${reportData.id}, 事件数: ${reportData.events.length}`);

            // 重置会话（保留最后的完整快照）
            this.resetSession();

        } catch (error) {
            this.logger.error("executeReport error: ", error);

            // 上报失败，缓存到本地
            if (triggerReason !== 'cache_restore') {
                await this.cacheFailedReport();
            }
        }
    }

    // 准备上报数据
    private prepareReportData(triggerReason: 'manual' | 'beforeunload' | 'cache_restore'): ReportData {
        const events = this.getCompleteEventSequence();
        const eventsJson = safeJsonStringify(events);

        return {
            id: this.session.sessionId,
            events: events,
            errorId: this.session.errorId || null,
            triggerType: this.session.triggerType,
            metadata: {
                startTime: this.session.startTime,
                endTime: Date.now(),
                duration: Date.now() - this.session.startTime,
                eventCount: events.length,
                url: window.location.href,
                userAgent: navigator.userAgent,
                triggerReason
            },
            compressed: false,
            size: new Blob([eventsJson]).size
        };
    }
    // 获取完整的事件序列（确保包含完整快照）
    private getCompleteEventSequence(): eventWithTime[] {
        const events = [...this.session.events];

        // 确保开头有完整快照
        if (this.session.lastFullSnapshot) {
            const hasFullSnapshot = events.some(event =>
                event.type === EventType.FullSnapshot && event.timestamp >= this.session.startTime
            );

            if (!hasFullSnapshot) {
                // 插入最后的完整快照到开头
                events.unshift(this.session.lastFullSnapshot);
            }
        }

        return events;
    }

    // 压缩上报数据
    private async compressReportData(reportData: ReportData): Promise<void> {
        try {
            // 移除不必要的事件
            const filteredEvents = this.filterUnnecessaryEvents(reportData.events);

            // 如果还是太大，保留关键事件
            if (this.config.maxReportSize && JSON.stringify(filteredEvents).length > this.config.maxReportSize / 2) {
                reportData.events = this.getKeyEvents(filteredEvents);
            } else {
                reportData.events = filteredEvents;
            }

            reportData.compressed = true;
            reportData.size = new Blob([JSON.stringify(reportData.events)]).size;

            this.logger.log(`数据压缩完成，原始事件数: ${reportData.metadata.eventCount}, 压缩后: ${reportData.events.length}`);
        } catch (error) {
            this.logger.error("compressReportData error: ", error);
        }
    }

    // 过滤不必要的事件
    private filterUnnecessaryEvents(events: eventWithTime[]): eventWithTime[] {
        return events.filter(event => {
            // 保留关键事件类型
            if (event.type === EventType.FullSnapshot ||
                event.type === EventType.Meta ||
                event.type === EventType.Load) {
                return true;
            }

            // 对于增量快照，过滤掉频繁的鼠标移动事件
            if (event.type === EventType.IncrementalSnapshot) {
                const data = event.data as any;
                if (data.source === 1 && data.type === 1) { // 鼠标移动
                    // 保留部分鼠标移动事件
                    return Math.random() < 0.1;
                }
            }

            return true;
        });
    }

    // 获取关键事件（确保录制完整性）
    private getKeyEvents(events: eventWithTime[]): eventWithTime[] {
        const keyEvents: eventWithTime[] = [];
        let lastFullSnapshot: eventWithTime | null = null;

        for (const event of events) {
            // 必须保留的事件类型
            if (event.type === EventType.FullSnapshot ||
                event.type === EventType.Meta ||
                event.type === EventType.Load) {
                keyEvents.push(event);
                if (event.type === EventType.FullSnapshot) {
                    lastFullSnapshot = event;
                }
            }
            // 保留用户交互事件
            else if (event.type === EventType.IncrementalSnapshot) {
                const data = event.data as any;
                if (data.source === 2 || // 鼠标交互
                    data.source === 3 || // 滚动
                    data.source === 5) { // 输入
                    keyEvents.push(event);
                }
            }
        }

        // 确保有完整快照
        if (lastFullSnapshot && keyEvents[0]?.type !== EventType.FullSnapshot) {
            keyEvents.unshift(lastFullSnapshot);
        }

        return keyEvents;
    }

    // 重置会话
    private resetSession(): void {
        // 保留最后的完整快照作为下一个会话的起点
        const lastFullSnapshot = this.session.lastFullSnapshot;

        this.session = this.createNewSession();
        this.session.lastFullSnapshot = lastFullSnapshot;

        // 如果有完整快照，添加到新会话的开头
        if (lastFullSnapshot) {
            this.session.events = [lastFullSnapshot];
        }
    }

    // 修剪事件数组
    private trimEvents(): void {
        const targetSize = Math.floor((this.config?.maxCacheEvents || 0) * 0.8);
        const eventsToRemove = this.session.events.length - targetSize;

        if (eventsToRemove > 0) {
            // 找到最近的完整快照
            let lastFullSnapshotIndex = -1;
            for (let i = this.session.events.length - 1; i >= 0; i--) {
                if (this.session.events[i].type === EventType.FullSnapshot) {
                    lastFullSnapshotIndex = i;
                    break;
                }
            }

            // 如果找到完整快照，从它开始保留
            if (lastFullSnapshotIndex > 0) {
                this.session.events = this.session.events.slice(lastFullSnapshotIndex);
                this.session.lastFullSnapshot = this.session.events[0];
            } else {
                // 否则移除最旧的事件
                this.session.events.splice(0, eventsToRemove);
            }
        }
    }

    // 检查内存使用
    private checkMemoryUsage(): void {
        const memory = (performance as any).memory as PerformanceMemory;
        if (typeof performance !== 'undefined' && memory) {
            const memoryUsage = memory.usedJSHeapSize / 1024 / 1024;
            if (!(this.config.performance) || (this.config.performance.maxMemoryUsage && memoryUsage > this.config.performance.maxMemoryUsage)) {
                this.logger.warn(`内存使用过高: ${memoryUsage.toFixed(2)}MB，执行清理`);
                this.trimEvents();
            }
        }
    }

    // 启动内存清理
    private startMemoryCleanup(): void {
        if (this.config.performance) {
            this.memoryCleanTimer = setInterval(() => {
                this.trimEvents();
            }, this.config.performance.memoryCleanInterval);
        }
    }

    // 设置页面卸载处理
    private setupBeforeUnloadHandler(): void {
        addEventListener(window, "beforeunload", () => {
            this.handleBeforeUnload();
        })
        addEventListener(window, "pagehide", () => {
            this.handleBeforeUnload();
        })
    }

    // 处理页面卸载
    private handleBeforeUnload(): void {
        try {
            // 取消延迟上报定时器
            if (this.session.reportTimer) {
                clearTimeout(this.session.reportTimer);
            }

            // 立即缓存当前录制数据
            this.cacheCurrentSession();

            this.logger.log('页面卸载，已缓存录制数据');
        } catch (error) {
            this.logger.error('页面卸载处理错误:', error);
        }
    }

    // 缓存当前会话
    private cacheCurrentSession(): void {
        try {
            if (!this.session.isReporting) return;
            const cacheData: CacheData = {
                sessionId: this.session.sessionId,
                errorId: this.session.errorId || null,
                events: this.getCompleteEventSequence(),
                triggerType: this.session.triggerType,
                metadata: {
                    startTime: this.session.startTime,
                    endTime: Date.now(),
                    url: window.location.href,
                    userAgent: navigator.userAgent
                },
                timestamp: Date.now()
            };

            const cacheKey = `${this.config.cacheKeyPrefix}${this.session.sessionId}`;
            localStorage.setItem(cacheKey, safeJsonStringify(cacheData));
        } catch (error) {
            this.logger.error('缓存会话数据失败:', error);
        }
    }

    // 缓存失败的上报
    private async cacheFailedReport(): Promise<void> {
        try {
            const reportData = this.prepareReportData('manual');
            const cacheKey = `${this.config.cacheKeyPrefix}failed_${reportData.id}`;

            const cacheData: CacheData = {
                sessionId: reportData.id,
                errorId: reportData.errorId || null,
                events: reportData.events,
                triggerType: reportData.triggerType,
                metadata: {
                    startTime: reportData.metadata.startTime,
                    endTime: reportData.metadata.endTime,
                    url: reportData.metadata.url,
                    userAgent: reportData.metadata.userAgent
                },
                timestamp: Date.now()
            };

            localStorage.setItem(cacheKey, safeJsonStringify(cacheData));
            this.logger.log('上报失败，已缓存到本地');
        } catch (error) {
            this.logger.error('缓存失败上报数据失败:', error);
        }
    }

    // 恢复缓存的录制数据
    private async restoreCachedRecordings(): Promise<void> {
        try {
            const cacheKeys = Object.keys(localStorage).filter(key =>
                key.startsWith(<string>this.config.cacheKeyPrefix)
            );
            this.logger.log("cacheKeys: ", cacheKeys);

            for (const cacheKey of cacheKeys) {
                try {
                    const cacheDataStr = localStorage.getItem(cacheKey);
                    this.logger.log("cacheDataStr: ", cacheDataStr);
                    if (!cacheDataStr) continue;

                    const cacheData: CacheData = JSON.parse(cacheDataStr);

                    // 检查缓存时间（避免过期数据）
                    const cacheAge = Date.now() - cacheData.timestamp;
                    if (cacheAge > 24 * 60 * 60 * 1000) { // 24小时
                        localStorage.removeItem(cacheKey);
                        continue;
                    }

                    // 恢复并上报缓存数据
                    await this.reportCachedData(cacheData);

                    // 清除已上报的缓存
                    localStorage.removeItem(cacheKey);

                } catch (error) {
                    this.logger.error('恢复缓存数据失败:', error);
                    localStorage.removeItem(cacheKey);
                }
            }
        } catch (error) {
            this.logger.error('恢复缓存录制数据失败:', error);
        }
    }

    // 上报缓存数据
    private async reportCachedData(cacheData: CacheData): Promise<void> {
        try {
            const reportData = {
                id: cacheData.sessionId,
                errorId: cacheData.errorId || null,
                events: safeJsonStringify(cacheData.events),
                metadata: {
                    ...cacheData.metadata,
                    duration: cacheData.metadata.endTime - cacheData.metadata.startTime,
                    eventCount: cacheData.events.length,
                    triggerReason: 'cache_restore'
                },
                compressed: false,
                size: new Blob([JSON.stringify(cacheData.events)]).size
            };

            // 上报数据
            await this.report({
                type: MonitorType.RECORD,
                data: reportData
            });
            this.logger.log(`恢复缓存数据上报完成，会话ID: ${cacheData.sessionId}`);
        } catch (error) {
            this.logger.error('上报缓存数据失败:', error);
            throw error;
        }
    }

    // 获取当前状态
    public getStatus(): {
        sessionId: string;
        isRecording: boolean;
        isReporting: boolean;
        eventCount: number;
        memoryUsage: number;
        cacheCount: number;
    } {
        const cacheCount = Object.keys(localStorage).filter(key =>
            key.startsWith(<string>this.config.cacheKeyPrefix)
        ).length;

        const memory = (performance as any).memory as PerformanceMemory;
        return {
            sessionId: this.session.sessionId,
            isRecording: this.stopRecording !== null,
            isReporting: this.session.isReporting,
            eventCount: this.session.events.length,
            memoryUsage: typeof performance !== 'undefined' && memory ?
                Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
            cacheCount
        };
    }
}
