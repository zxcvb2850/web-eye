import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import { generateId, safeJsonStringify } from "../utils/common";
import { addEventListener } from "../utils/helpers";
import { IndexedDBManager } from "../utils/indexedDBManager";

// rrweb record function type, will be loaded dynamically
type RecordFn = (options: any) => (() => void) | void;

/**
 * rrweb事件类型枚举
 */
enum EventType {
    DomContentLoaded = 0,
    Load = 1,
    FullSnapshot = 2,
    IncrementalSnapshot = 3,
    Meta = 4,
    Custom = 5,
    Plugin = 6
}

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
 * 完整会话数据结构
 */
interface CompleteSession {
    meta: RecordEvent;           // Meta事件（必需）
    fullSnapshot: RecordEvent;   // 完整DOM快照（必需）
    incrementalEvents: RecordEvent[]; // 增量事件
}

/**
 * 录制会话
 */
interface RecordSession {
    id: string;
    triggerType: RecordTriggerType;
    errorId?: string;
    startTime: number;
    endTime?: number;
    events: RecordEvent[];
    status: 'recording' | 'completed' | 'error';
    isComplete: boolean; // 是否包含完整的回放数据
}

/**
 * 智能事件管理器 - 确保录制数据完整性
 */
class SmartEventManager {
    private metaEvent: RecordEvent | null = null;
    private latestFullSnapshot: RecordEvent | null = null;
    private incrementalBuffer: RecordEvent[] = [];
    private maxIncrementalEvents: number;

    constructor(maxIncrementalEvents: number = 200) {
        this.maxIncrementalEvents = maxIncrementalEvents;
    }

    /**
     * 处理新事件
     */
    processEvent(event: RecordEvent): void {
        switch (event.type) {
            case EventType.Meta:
                this.metaEvent = event;
                break;

            case EventType.FullSnapshot:
                this.latestFullSnapshot = event;
                // 清空增量事件缓冲区，因为有了新的完整快照
                this.incrementalBuffer = [];
                break;

            case EventType.IncrementalSnapshot:
                this.incrementalBuffer.push(event);
                // 保持缓冲区大小
                if (this.incrementalBuffer.length > this.maxIncrementalEvents) {
                    this.incrementalBuffer.shift();
                }
                break;

            default:
                // 其他事件也加入增量缓冲区
                this.incrementalBuffer.push(event);
                if (this.incrementalBuffer.length > this.maxIncrementalEvents) {
                    this.incrementalBuffer.shift();
                }
                break;
        }
    }

    /**
     * 获取完整的回放会话数据
     */
    getCompleteSession(): CompleteSession | null {
        if (!this.metaEvent || !this.latestFullSnapshot) {
            return null;
        }

        return {
            meta: this.metaEvent,
            fullSnapshot: this.latestFullSnapshot,
            incrementalEvents: [...this.incrementalBuffer]
        };
    }

    /**
     * 构建完整的事件序列
     */
    buildCompleteEventSequence(): RecordEvent[] {
        const session = this.getCompleteSession();
        if (!session) {
            return [];
        }

        // 按时间戳排序，确保事件顺序正确
        const allEvents = [
            session.meta,
            session.fullSnapshot,
            ...session.incrementalEvents
        ].sort((a, b) => a.timestamp - b.timestamp);

        return allEvents;
    }

    /**
     * 检查是否有完整数据
     */
    isComplete(): boolean {
        return !!(this.metaEvent && this.latestFullSnapshot);
    }

    /**
     * 强制生成完整快照
     */
    forceFullSnapshot(): void {
        // 触发rrweb生成新的完整快照
        try {
            if (typeof (window as any).rrwebTakeFullSnapshot === 'function') {
                (window as any).rrwebTakeFullSnapshot();
            }
        } catch (error) {
            console.warn('Failed to force full snapshot:', error);
        }
    }

    /**
     * 清空缓冲区
     */
    clear(): void {
        this.metaEvent = null;
        this.latestFullSnapshot = null;
        this.incrementalBuffer = [];
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            hasMeta: !!this.metaEvent,
            hasFullSnapshot: !!this.latestFullSnapshot,
            incrementalCount: this.incrementalBuffer.length,
            isComplete: this.isComplete()
        };
    }
}

/**
 * 录制配置接口
 */
interface RecordConfig {
    // 录制配置
    recordOptions: any;
    maxDuration: number;
    bufferTime: number;
    afterTime: number;
    maxEvents: number;

    // 快照策略
    forceSnapshotOnStart: boolean; // 开始录制时强制生成快照
    snapshotInterval: number; // 快照生成间隔
    waitForSnapshot: boolean; // 是否等待快照生成
    snapshotTimeout: number; // 等待快照的超时时间

    // 完整性检查
    validateBeforeReport: boolean; // 上报前验证数据完整性
    retryOnIncomplete: boolean; // 数据不完整时重试

    // 压缩和存储
    enableCompression: boolean;
    compressionLevel: number;
    maxStorageSize: number;
    cleanupThreshold: number;
}

/**
 * rrweb 录制插件 - 确保录制数据完整性
 */
export class RecordPlugin extends Plugin {
    name = 'RecordPlugin';

    private config: RecordConfig = {
        // 基础录制配置
        recordOptions: {
            checkoutEveryNms: 10000, // 10秒生成checkpoint
            checkoutEveryNth: 100,    // 100个事件生成checkpoint
            maskAllInputs: true,
            maskTextSelector: '[data-mask]',
            ignoreSelector: '[data-ignore]',
            maskInputOptions: {
                password: true,
                email: false,
                number: false,
                search: false,
                tel: false,
                url: false
            },
            recordCanvas: true,      // 启用canvas录制
            recordCrossOriginIframes: false,
            collectFonts: true,      // 收集字体，避免样式问题
            sampling: {
                scroll: 500,
                mousemove: 500,
                mouseInteraction: true,
                input: 'last'
            },
            // 关键：确保记录所有必要信息
            inlineStylesheet: true,  // 内联样式表
            recordLog: true          // 记录控制台日志
        },
        maxDuration: 30000,
        bufferTime: 8000,        // 增加缓冲时间
        afterTime: 5000,         // 增加后置时间
        maxEvents: 5000,

        // 快照策略
        forceSnapshotOnStart: true,
        snapshotInterval: 8000,
        waitForSnapshot: true,
        snapshotTimeout: 2000,

        // 完整性检查
        validateBeforeReport: true,
        retryOnIncomplete: true,

        // 压缩和存储
        enableCompression: true,
        compressionLevel: 6,
        maxStorageSize: 500 * 1024 * 1024, // 500MB
        cleanupThreshold: 0.8
    };

    private stopRecording: any | null = null;
    private eventManager: SmartEventManager;
    private activeSessions: Map<string, RecordSession> = new Map();
    private isRecording = false;
    private currentSessionId: string | null = null;

    // 定时器管理
    private timers: {
        dbCheck?: NodeJS.Timeout;
        snapshot?: NodeJS.Timeout;
        sessionEnd?: NodeJS.Timeout;
    } = {};

    // 数据存储
    private db?: IndexedDBManager;
    private dbStoreName = "records";
    private errorSessionMap: Map<string, string> = new Map();

    // Dynamically loaded rrweb record function
    private recordFn: RecordFn | null = null;
    private isRrwebLoaded = false;

    constructor(config?: Partial<RecordConfig>) {
        super();
        this.config = { ...this.config, ...config };
        this.eventManager = new SmartEventManager(300);
    }

    protected async init(): Promise<void> {
        this.logger.log('Initializing RecordPlugin...');

        try {
            const { record } = await import('rrweb');
            this.recordFn = record;
            this.isRrwebLoaded = true;
            this.logger.log('rrweb loaded successfully.');
        } catch (error) {
            this.isRrwebLoaded = false;
            this.logger.warn('Failed to load rrweb. Recording feature will be disabled. This might be caused by an ad blocker.', error);
            return; // Stop initialization if rrweb fails to load
        }

        this.db = IndexedDBManager.getInstance();

        // 等待页面完全加载
        await this.waitForPageReady();

        // 开始录制
        this.startContinuousRecording();

        // 绑定事件
        this.bindPageEvents();

        // 开始定期快照
        this.startPeriodicSnapshot();

        // 检查缓存数据
        this.checkPendingData();
    }

    protected destroy(): void {
        this.logger.log('Destroying RecordPlugin');

        this.stopCurrentRecording();
        this.clearAllTimers();
        this.activeSessions.clear();
        this.errorSessionMap.clear();
        this.eventManager.clear();
    }

    /**
     * 等待页面准备就绪
     */
    private async waitForPageReady(): Promise<void> {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                const handler = () => {
                    if (document.readyState === 'complete') {
                        document.removeEventListener('readystatechange', handler);
                        resolve();
                    }
                };
                document.addEventListener('readystatechange', handler);

                // 超时保护
                setTimeout(resolve, 3000);
            }
        });
    }

    /**
     * 开始持续录制
     */
    private startContinuousRecording(): void {
        if (!this.isRrwebLoaded || !this.recordFn || this.isRecording) {
            return;
        }

        try {
            // 存储takeFullSnapshot引用，用于强制生成快照
            let takeFullSnapshot: (() => void) | null = null;

            this.stopRecording = this.recordFn({
                ...this.config.recordOptions,
                emit: (event: RecordEvent) => {
                    // 处理事件
                    this.handleRecordEvent(event);
                },
                // 获取takeFullSnapshot方法
                ...(this.config.recordOptions.checkoutEveryNms && {
                    checkoutEveryNms: this.config.recordOptions.checkoutEveryNms,
                    // 保存takeFullSnapshot方法
                    checkout: (takeFullSnapshotImpl: () => void) => {
                        takeFullSnapshot = takeFullSnapshotImpl;
                        (window as any).rrwebTakeFullSnapshot = takeFullSnapshotImpl;
                        return takeFullSnapshotImpl;
                    }
                })
            });

            this.isRecording = true;

            // 立即生成一次完整快照
            if (this.config.forceSnapshotOnStart) {
                setTimeout(() => {
                    if (takeFullSnapshot) {
                        takeFullSnapshot();
                    }
                }, 500);
            }

            this.logger.log('Continuous recording started');
        } catch (error) {
            this.logger.error('Failed to start recording:', error);
            this.isRecording = false;
        }
    }

    /**
     * 处理录制事件
     */
    private handleRecordEvent(event: RecordEvent): void {
        if (!this.isRrwebLoaded) return;
        // 如果有活跃会话，直接添加到会话
        if (this.currentSessionId) {
            const session = this.activeSessions.get(this.currentSessionId);
            if (session && session.status === 'recording') {
                this.addEventToSession(this.currentSessionId, event);
                return;
            }
        }

        // 否则添加到事件管理器的缓冲区
        this.eventManager.processEvent(event);
    }

    /**
     * 开始定期快照
     */
    private startPeriodicSnapshot(): void {
        if (!this.isRrwebLoaded) return;
        this.timers.snapshot = setInterval(() => {
            if (this.isRecording && (window as any).rrwebTakeFullSnapshot) {
                try {
                    (window as any).rrwebTakeFullSnapshot();
                    this.logger.log('Periodic snapshot generated');
                } catch (error) {
                    this.logger.warn('Failed to generate periodic snapshot:', error);
                }
            }
        }, this.config.snapshotInterval);
    }

    /**
     * 错误触发录制
     */
    public async errorTrigger(errorId: string): Promise<string | null> {
        if (!this.isRrwebLoaded) return null;
        this.logger.log('Error triggered recording:', errorId);
        const sessionId = await this.startSession(RecordTriggerType.ERROR, errorId);

        if (sessionId && errorId) {
            this.errorSessionMap.set(errorId, sessionId);
        }

        return sessionId;
    }

    /**
     * 手动触发录制
     */
    public manualTrigger(triggerData?: any): Promise<string | null> {
        if (!this.isRrwebLoaded) return Promise.resolve(null);
        return this.startSession(RecordTriggerType.MANUAL, triggerData);
    }

    /**
     * 自定义触发录制
     */
    public customTrigger(errorId?: string): Promise<string | null> {
        if (!this.isRrwebLoaded) return Promise.resolve(null);
        return this.startSession(RecordTriggerType.CUSTOM, errorId);
    }

    /**
     * 开始录制会话
     */
    private async startSession(triggerType: RecordTriggerType, errorId?: string): Promise<string | null> {
        if (!this.isRrwebLoaded) return null;
        try {
            const sessionId = generateId();

            // 如果需要等待完整快照
            if (this.config.waitForSnapshot && !this.eventManager.isComplete()) {
                await this.ensureCompleteSnapshot();
            }

            // 获取完整的事件序列
            const completeEvents = this.eventManager.buildCompleteEventSequence();

            const session: RecordSession = {
                id: sessionId,
                triggerType,
                errorId,
                startTime: Date.now(),
                events: [...completeEvents],
                status: 'recording',
                isComplete: this.eventManager.isComplete()
            };

            this.activeSessions.set(sessionId, session);
            this.currentSessionId = sessionId;

            this.logger.log(`Recording session started: ${sessionId}`, {
                triggerType,
                eventsCount: completeEvents.length,
                isComplete: session.isComplete,
                managerStatus: this.eventManager.getStatus()
            });

            // 设置会话结束定时器
            this.scheduleSessionEnd(sessionId);

            return sessionId;
        } catch (error) {
            this.logger.error('Failed to start recording session:', error);
            return null;
        }
    }

    /**
     * 确保有完整快照
     */
    private async ensureCompleteSnapshot(): Promise<void> {
        if (this.eventManager.isComplete()) {
            return;
        }

        return new Promise((resolve) => {
            // 强制生成快照
            this.eventManager.forceFullSnapshot();

            // 等待快照生成或超时
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (this.eventManager.isComplete() ||
                    Date.now() - startTime > this.config.snapshotTimeout) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * 添加事件到会话
     */
    private addEventToSession(sessionId: string, event: RecordEvent): void {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.status !== 'recording') return;

        if (session.events.length >= this.config.maxEvents) {
            this.endSession(sessionId, 'max_events_reached');
            return;
        }

        session.events.push(event);

        // 更新完整性状态
        if (event.type === EventType.FullSnapshot || event.type === EventType.Meta) {
            session.isComplete = this.validateSessionCompleteness(session);
        }
    }

    /**
     * 验证会话完整性
     */
    private validateSessionCompleteness(session: RecordSession): boolean {
        let hasMeta = false;
        let hasFullSnapshot = false;

        for (const event of session.events) {
            if (event.type === EventType.Meta) hasMeta = true;
            if (event.type === EventType.FullSnapshot) hasFullSnapshot = true;
            if (hasMeta && hasFullSnapshot) return true;
        }

        return false;
    }

    /**
     * 计划会话结束
     */
    private scheduleSessionEnd(sessionId: string): void {
        this.timers.sessionEnd = setTimeout(() => {
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
        session.isComplete = this.validateSessionCompleteness(session);

        this.logger.log(`Session ended: ${sessionId}`, {
            reason,
            eventsCount: session.events.length,
            isComplete: session.isComplete
        });

        this.currentSessionId = null;

        if (reason === 'page_unload') {
            this.cacheSession(session);
        } else {
            this.reportSession(session);
        }

        this.activeSessions.delete(sessionId);

        if (this.timers.sessionEnd) {
            clearTimeout(this.timers.sessionEnd);
            this.timers.sessionEnd = undefined;
        }
    }

    /**
     * 上报录制会话
     */
    private async reportSession(session: RecordSession): Promise<void> {
        try {
            // 验证数据完整性
            if (this.config.validateBeforeReport && !session.isComplete) {
                this.logger.warn(`Session ${session.id} is incomplete, attempting to fix`);

                if (this.config.retryOnIncomplete) {
                    // 尝试补充缺失的事件
                    await this.fixIncompleteSession(session);
                }
            }

            if (!session.isComplete) {
                this.logger.error(`Session ${session.id} still incomplete after fix attempt`);
                // 可以选择不上报或标记为不完整上报
            }

            const reportData = {
                id: session.id,
                triggerType: session.triggerType,
                errorId: session.errorId,
                events: safeJsonStringify(session.events),
                startTime: session.startTime,
                endTime: session.endTime,
                isComplete: session.isComplete,
                eventsCount: session.events.length,
                timestamp: Date.now()
            };

            await this.report({
                type: MonitorType.RECORD,
                data: reportData
            });

            this.logger.log(`Session ${session.id} reported successfully`);
        } catch (error) {
            this.logger.error(`Failed to report session ${session.id}:`, error);

            // 保存到本地存储
            if (this.db) {
                this.db.add(this.dbStoreName, session);
            }

            session.status = 'error';
        }
    }

    /**
     * 修复不完整的会话
     */
    private async fixIncompleteSession(session: RecordSession): Promise<void> {
        const completeSession = this.eventManager.getCompleteSession();
        if (!completeSession) return;

        let hasMeta = false;
        let hasFullSnapshot = false;

        // 检查缺失的事件类型
        for (const event of session.events) {
            if (event.type === EventType.Meta) hasMeta = true;
            if (event.type === EventType.FullSnapshot) hasFullSnapshot = true;
        }

        // 补充Meta事件
        if (!hasMeta && completeSession.meta) {
            session.events.unshift(completeSession.meta);
        }

        // 补充完整快照
        if (!hasFullSnapshot && completeSession.fullSnapshot) {
            // 找到合适的插入位置（在Meta之后）
            const insertIndex = hasMeta ? 1 : 0;
            session.events.splice(insertIndex, 0, completeSession.fullSnapshot);
        }

        // 重新排序事件
        session.events.sort((a, b) => a.timestamp - b.timestamp);
        session.isComplete = this.validateSessionCompleteness(session);
    }

    /**
     * 缓存会话到本地存储
     */
    private cacheSession(session: RecordSession): void {
        try {
            if (this.db) {
                this.db.add(this.dbStoreName, session);
                this.logger.log(`Session ${session.id} cached successfully`);
            }
        } catch (error) {
            this.logger.error(`Failed to cache session ${session.id}:`, error);
        }
    }

    /**
     * 检查待处理数据
     */
    private async checkPendingData(): Promise<void> {
        if (!this.isRrwebLoaded) return;
        if (!this.db?.loaded) {
            this.timers.dbCheck = setTimeout(() => this.checkPendingData(), 200);
            return;
        }

        try {
            const sessions = await this.db.getAll(this.dbStoreName);
            for (const session of sessions) {
                await this.reportSession(session);
                await this.db.delete(this.dbStoreName, session.id);
            }
        } catch (error) {
            this.logger.error('Failed to process pending data:', error);
        }
    }

    /**
     * 绑定页面事件
     */
    private bindPageEvents(): void {
        const handleUnload = () => {
            this.activeSessions.forEach((session, sessionId) => {
                if (session.status === 'recording') {
                    this.endSession(sessionId, 'page_unload');
                }
            });
        };

        addEventListener(window, 'beforeunload', handleUnload);
        addEventListener(window, 'visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                handleUnload();
            }
        });
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
     * 清理所有定时器
     */
    private clearAllTimers(): void {
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        this.timers = {};
    }

    /**
     * 获取录制状态
     */
    public getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            activeSessions: this.activeSessions.size,
            eventManagerStatus: this.eventManager.getStatus(),
            currentSessionId: this.currentSessionId
        };
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
        this.logger.log('Config updated:', config);
    }

    /**
     * 获取配置
     */
    public getConfig(): RecordConfig {
        return { ...this.config };
    }
}
