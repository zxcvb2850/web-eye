import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import {generateId} from "../utils/common";
import { record } from 'rrweb';

/**
 * 录制事件类型
 */
export enum RecordTriggerType {
    MANUAL = 'manual',      // 手动触发
    ERROR = 'error',        // 错误触发
    CUSTOM = 'custom'       // 自定义触发
}

/**
 * 录制事件数据
 */
interface RecordEvent {
    type: number;
    data: any;
    timestamp: number;
}

/**
 * 录制会话
 */
interface RecordSession {
    id: string;
    triggerType: RecordTriggerType;
    relatedId?: string; // 触发错误的ID
    startTime: number;
    endTime?: number;
    events: RecordEvent[];
    status: 'recording' | 'completed' | 'error';
}

/**
 * 循环缓冲区
 */
class CircularBuffer<T> {
    private buffer: T[] = [];
    private size: number;
    private head = 0;
    private tail = 0;
    private count = 0;

    constructor(size: number) {
        this.size = size;
        this.buffer = new Array(size);
    }

    push(item: T): void {
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.size;

        if (this.count < this.size) {
            this.count++;
        } else {
            this.head = (this.head + 1) % this.size;
        }
    }

    getAll(): T[] {
        if (this.count === 0) return [];

        const result: T[] = [];
        let current = this.head;

        for (let i = 0; i < this.count; i++) {
            result.push(this.buffer[current]);
            current = (current + 1) % this.size;
        }

        return result;
    }

    clear(): void {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }

    getCount(): number {
        return this.count;
    }
}

/**
 * 录制配置接口
 */
interface RecordConfig {
    // 录制配置
    recordOptions: any; // RecordOptions 类型
    maxDuration: number; // 最大录制时长(ms)
    bufferTime: number; // 前置缓冲时间(ms) - 发生事件前的录制时间
    afterTime: number; // 后置录制时间(ms) - 发生事件后的录制时间

    // 数据管理
    maxEvents: number; // 单次录制最大事件数

    // 压缩配置
    enableCompression: boolean; // 启用压缩
    compressionLevel: number; // 压缩级别 1-9

    // 存储配置
    maxStorageSize: number; // 最大存储大小(字节)
    cleanupThreshold: number; // 清理阈值
}

/**
 * rrweb 录制插件
 * */
export class RecordPlugin extends Plugin {
    name = 'RecordPlugin';

    private config: RecordConfig = {
        // 录制配置
        recordOptions: {
            checkoutEveryNms: 30000, // 30秒创建一个checkpoint
            checkoutEveryNth: 80,   // 每200个事件创建一个checkpoint
            maskAllInputs: true,     // 屏蔽所有输入
            maskTextSelector: '[data-mask]', // 文本屏蔽选择器
            // blockSelector: '[data-block]',   // 元素阻止选择器
            ignoreSelector: '[data-ignore]', // 忽略选择器
            maskInputOptions: {
                password: true,
                email: false,
                number: false,
                search: false,
                tel: false,
                url: false
            },
            recordCanvas: false,     // 是否录制canvas
            recordCrossOriginIframes: false, // 是否录制跨域iframe
            collectFonts: false,     // 是否收集字体
            sampling: {
                scroll: 800,         // 滚动事件采样间隔
                mousemove: 600,       // 鼠标移动采样间隔
                mouseInteraction: true, // 鼠标交互事件
                input: 'last'        // 输入事件采样策略
            }
        },
        maxDuration: 30000, // 30秒
        bufferTime: 3000,   // 前3秒
        afterTime: 3000,    // 后3秒

        // 数据管理
        maxEvents: 1000,

        // 压缩配置
        enableCompression: true,
        compressionLevel: 6,

        // 存储配置
        maxStorageSize: 50 * 1024 * 1024, // 50MB
        cleanupThreshold: 0.8 // 80%时清理
    };

    private stopRecording: ReturnType<typeof record> | null = null;
    private eventBuffer: CircularBuffer<RecordEvent>;
    private activeSessions: Map<string, RecordSession> = new Map();
    private isRecording = false;
    private currentSessionId: string | null = null;

    // 存储管理
    private storageSize = 0;

    // 定时器
    private bufferTimer: NodeJS.Timeout | null = null;
    private afterTimer: NodeJS.Timeout | null = null;

    // 错误-录制会话映射
    private errorSessionMap: Map<string, string> = new Map();

    constructor(config?: Partial<RecordConfig>) {
        super();
        this.config = { ...this.config, ...config };

        // 初始化事件缓冲区 (前置缓冲时间 / 平均事件间隔)
        const bufferSize = Math.ceil(this.config.bufferTime / 100); // 假设平均100ms一个事件
        this.eventBuffer = new CircularBuffer<RecordEvent>(Math.max(bufferSize, 50));
    }

    protected init(): void {
        this.logger.log('Init RecordPlugin');

        // 初始化存储大小统计
        this.calculateStorageSize();

        // 开始持续录制到缓冲区
        this.startBufferRecording();

        // 绑定页面卸载事件
        this.bindUnloadEvents();
    }

    protected destroy(): void {
        this.logger.log('Destroy RecordPlugin');

        // 停止录制
        this.stopCurrentRecording();

        // 清理定时器
        if (this.bufferTimer) {
            clearTimeout(this.bufferTimer);
            this.bufferTimer = null;
        }

        if (this.afterTimer) {
            clearTimeout(this.afterTimer);
            this.afterTimer = null;
        }

        // 清理所有会话
        this.activeSessions.clear();

        // 清理错误-会话映射
        this.errorSessionMap.clear();

        // 清理缓冲区
        this.eventBuffer.clear();
    }

    /**
     * 开始缓冲录制 - 持续录制到循环缓冲区
     */
    private startBufferRecording(): void {
        if (this.isRecording) return;

        try {
            this.stopRecording = record({
                ...this.config.recordOptions,
                emit: (event: RecordEvent) => {
                    // 只在缓冲阶段时才添加到缓冲区
                    if (!this.currentSessionId) {
                        this.eventBuffer.push(event);
                    } else {
                        // 如果有活跃会话，直接添加到会话中
                        const session = this.activeSessions.get(this.currentSessionId);
                        if (session && session.status === 'recording') {
                            this.addEventToSession(this.currentSessionId, event);
                        }
                    }
                }
            });

            this.isRecording = true;
            this.logger.log('Buffer recording started');
        } catch (error) {
            this.logger.error('Failed to start buffer recording:', error);
        }
    }

    /**
     * 停止当前录制
     */
    private stopCurrentRecording(): void {
        if (this.stopRecording) {
            this.stopRecording();
            this.stopRecording = null;
            this.isRecording = false;
        }
    }

    /**
     * 手动触发录制
     */
    public manualTrigger(triggerData?: any): string | null {
        return this.startSession(RecordTriggerType.MANUAL, triggerData);
    }

    /**
     * 自定义触发录制
     */
    public customTrigger(errorId?: string): string | null {
        return this.startSession(RecordTriggerType.CUSTOM, errorId);
    }

    /**
     * 错误触发录制
     */
    public errorTrigger(errorId: string): string | null {
        this.logger.log('Error triggered recording:', errorId);

        // 延迟触发，给错误处理一些时间
        const sessionId = this.startSession(RecordTriggerType.ERROR, errorId);

        // 建立错误ID与录制会话ID的映射
        if (sessionId && errorId) {
            this.errorSessionMap.set(errorId, sessionId);
        }

        return sessionId;
    }

    /**
     * 开始录制会话
     */
    private startSession(triggerType: RecordTriggerType, relatedId?: string): string | null {
        try {
            const sessionId = generateId();

            // 创建录制会话
            const session: RecordSession = {
                id: sessionId,
                triggerType,
                relatedId,
                startTime: Date.now(),
                events: [],
                status: 'recording'
            };

            // 添加缓冲区的事件
            const bufferEvents = this.eventBuffer.getAll();
            session.events.push(...bufferEvents);

            this.activeSessions.set(sessionId, session);
            this.currentSessionId = sessionId;

            this.logger.log(`Recording session started: ${sessionId}`, {
                triggerType,
                bufferEvents: bufferEvents.length
            });

            // 设置录制结束定时器
            this.scheduleSessionEnd(sessionId);

            return sessionId;
        } catch (error) {
            this.logger.error('Failed to start recording session:', error);
            return null;
        }
    }

    /**
     * 添加事件到会话
     */
    private addEventToSession(sessionId: string, event: RecordEvent): void {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.status !== 'recording') return;

        // 检查事件数量限制
        if (session.events.length >= this.config.maxEvents) {
            this.endSession(sessionId, 'max_events_reached');
            return;
        }

        session.events.push(event);
    }

    /**
     * 计划会话结束
     */
    private scheduleSessionEnd(sessionId: string): void {
        // 设置后置录制时间结束定时器
        this.afterTimer = setTimeout(() => {
            this.endSession(sessionId, 'time_limit_reached');
        }, this.config.afterTime);
    }

    /**
     * 结束录制会话
     */
    private endSession(sessionId: string, reason: string): void {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        session.status = 'completed';
        session.endTime = Date.now();

        this.logger.log(`Recording session ended: ${sessionId}`, {
            reason,
        });

        // 清理当前会话ID
        this.currentSessionId = null;

        // 上报录制数据
        this.reportSession(session);

        // 清理会话
        this.activeSessions.delete(sessionId);

        // 清理定时器
        if (this.afterTimer) {
            clearTimeout(this.afterTimer);
            this.afterTimer = null;
        }
    }

    /**
     * 上报录制会话
     */
    private async reportSession(session: RecordSession): Promise<void> {
        try {
            let data = session.events;

            // 压缩数据
            if (this.config.enableCompression) {
                const compressed = await this.compressData(data);
                data = compressed.data;
            }

            // 准备上报数据
            const reportData = {
                sessionId: session.id,
                triggerType: session.triggerType,
                relatedId: session.relatedId,
                events: data,
                timestamp: Date.now()
            };

            // 上报数据
            await this.report({
                type: MonitorType.RECORD,
                data: reportData
            });
        } catch (error) {
            this.logger.error(`Failed to report recording session: ${session.id}`, error);
            session.status = 'error';
        }
    }

    /**
     * 压缩数据
     */
    private async compressData(data: any): Promise<{ data: any; size: number }> {
        try {
            // 检查 fflate 是否可用
            const fflate = (window as any).fflate;
            if (!fflate) {
                this.logger.warn('fflate is not available, skipping compression');
                const jsonStr = JSON.stringify(data);
                return {
                    data: jsonStr,
                    size: new Blob([jsonStr]).size
                };
            }

            // 序列化数据
            const jsonStr = JSON.stringify(data);
            const textEncoder = new TextEncoder();
            const uint8Array = textEncoder.encode(jsonStr);

            // 压缩数据
            const compressed = fflate.gzipSync(uint8Array, {
                level: this.config.compressionLevel
            });

            // 转换为base64
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));

            return {
                data: {
                    compressed: true,
                    data: base64,
                    originalSize: uint8Array.length
                },
                size: compressed.length
            };
        } catch (error) {
            this.logger.error('Compression failed:', error);
            const jsonStr = JSON.stringify(data);
            return {
                data: jsonStr,
                size: new Blob([jsonStr]).size
            };
        }
    }

    /**
     * 计算事件大小
     */
    private calculateEventSize(event: RecordEvent): number {
        try {
            const jsonStr = JSON.stringify(event);
            return new Blob([jsonStr]).size;
        } catch (error) {
            return 1024; // 默认1KB
        }
    }

    /**
     * 计算存储大小
     */
    private calculateStorageSize(): void {
        // 这里可以实现存储大小的计算逻辑
        // 目前简单设置为0
        this.storageSize = 0;
    }

    /**
     * 清理存储
     */
    private async cleanupStorage(): Promise<void> {
        this.logger.log('Starting storage cleanup');

        // 这里实现存储清理逻辑
        // 可以清理旧的录制数据

        // 重新计算存储大小
        this.calculateStorageSize();

        this.logger.log('Storage cleanup completed');
    }

    /**
     * 绑定页面卸载事件
     */
    private bindUnloadEvents(): void {
        const handleUnload = () => {
            this.handleBeforeUnload();
        };

        this.addEventListener(window, 'beforeunload', handleUnload);
        this.addEventListener(document, 'visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.handleBeforeUnload();
            }
        });
    }

    /**
     * 处理页面卸载
     */
    private handleBeforeUnload(): void {
        // 立即结束所有活跃的录制会话
        this.activeSessions.forEach((session, sessionId) => {
            if (session.status === 'recording') {
                this.endSession(sessionId, 'page_unload');
            }
        });
    }

    /**
     * 获取活跃会话信息
     */
    public getActiveSessions(): RecordSession[] {
        return Array.from(this.activeSessions.values());
    }

    /**
     * 强制结束会话
     */
    public forceEndSession(sessionId: string): boolean {
        const session = this.activeSessions.get(sessionId);
        if (!session) return false;

        this.endSession(sessionId, 'manual_stop');
        return true;
    }

    /**
     * 更新配置
     */
    public updateConfig(config: Partial<RecordConfig>): void {
        this.config = { ...this.config, ...config };
        this.logger.log('RecordPlugin config updated:', config);

        // 如果更新了缓冲区大小，需要重新创建缓冲区
        if (config.bufferTime) {
            const bufferSize = Math.ceil(this.config.bufferTime / 100);
            this.eventBuffer = new CircularBuffer<RecordEvent>(Math.max(bufferSize, 50));
        }
    }

    /**
     * 获取配置
     */
    public getConfig(): RecordConfig {
        return { ...this.config };
    }
}