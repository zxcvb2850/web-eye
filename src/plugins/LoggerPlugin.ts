import { Plugin } from "../core/Plugin";

/**
 * 日志等级枚举
 */
export enum LogLevel {
    DEBUG = 0,
    LOG = 1,
    WARN = 2,
    ERROR = 3,
}

/**
 * 日志记录接口
 */
interface LogRecord {
    id: string;
    level: LogLevel;
    levelName: string;
    message: string;
    args: any[];
    stack?: string;
    timestamp: number;
    isInternal?: boolean;
}

/**
 * Logger插件配置接口
 */
interface LoggerConfig {
    logLevel: LogLevel;
    maxRecords: number;
    dbName: string;
    storeName: string;
    enableStackTrace: boolean;
}

/**
 * 日志监控插件
 */
export class LoggerPlugin extends Plugin {
    name = 'LoggerPlugin';

    private config: LoggerConfig = {
        logLevel: LogLevel.DEBUG,
        maxRecords: 100,
        dbName: 'WebEyeLogger',
        storeName: 'logs',
        enableStackTrace: true,
    };

    private isReporting: boolean = false; // 上报标记
    private db: IDBDatabase | null = null;
    private readonly originalConsole: {
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
        debug: typeof console.debug;
    };

    // 内部Logger，不会被拦截
    private internalLogger = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console),
        info: console.info.bind(console),
    };

    // 标记，用于识别SDK内部调用
    private isInternalCall = false;

    // 对外提供的 Logger 接口，其他插件可以使用
    public logger = {
        debug: (...args: any[]) => this.internalLog(LogLevel.DEBUG, 'debug', args),
        log: (...args: any[]) => this.internalLog(LogLevel.LOG, 'log', args),
        warn: (...args: any[]) => this.internalLog(LogLevel.WARN, 'warn', args),
        error: (...args: any[]) => this.internalLog(LogLevel.ERROR, 'error', args),
    }

    constructor(config?: Partial<LoggerConfig>) {
        super();
        this.config = { ...this.config, ...config };

        // 保存原始console方法
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
        };
    }

    protected async init(): Promise<void> {
        this.internalLogger.info(`Init LoggerPlugin`);

        try {
            await this.initIndexedDB();
            this.hijackConsole();
        } catch (error) {
            this.internalLogger.error("Failed to initialize LoggerPlugin:", error);
        }
    }

    protected destroy(): void {
        this.restoreConsole();
        this.closeDB();
    }

    /**
     * 初始化IndexedDB
     */
    private async initIndexedDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.dbName, 1);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(this.config.storeName)) {
                    const store = db.createObjectStore(this.config.storeName, {
                        keyPath: 'id',
                        autoIncrement: false,
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('level', 'level', { unique: false });
                }
            };
        });
    }

    /**
     * SDK内部使用的日志方法
     */
    private internalLog(level: LogLevel, levelName: string, args: any[]): void {
        // 先输出到控制台
        this.internalLogger[levelName as keyof typeof this.internalLogger](...args);
    }

    /**
     * 劫持console方法
     */
    private hijackConsole(): void {
        const levels = [
            { method: 'debug', level: LogLevel.DEBUG },
            { method: 'log', level: LogLevel.LOG },
            { method: 'warn', level: LogLevel.WARN },
            { method: 'error', level: LogLevel.ERROR },
        ];

        levels.forEach(({ method, level }) => {
            const originalMethod = this.originalConsole[method as keyof typeof this.originalConsole];

            // 检查日志等级
            if (level < this.config.logLevel) {
                return;
            }
            (console as any)[method] = (...args: any[]) => {
                // 先执行原始console方法
                originalMethod.apply(console, args);

                // 检查是否为SDK内部调用或info调用
                if (this.isInternalCall || method === 'info') {
                    return;
                }

                // 记录日志
                this.recordLog(level, method, args);
            };
        });
    }

    /**
     * 恢复原始console方法
     */
    private restoreConsole(): void {
        Object.keys(this.originalConsole).forEach(method => {
            (console as any)[method] = this.originalConsole[method as keyof typeof this.originalConsole];
        });
    }

    /**
     * 记录日志到IndexedDB
     */
    private async recordLog(level: LogLevel, levelName: string, args: any[]): Promise<void> {
        if (!this.db) return;

        try {
            const logRecord: LogRecord = {
                id: this.generateId(),
                timestamp: Date.now(),
                level,
                levelName: levelName.toUpperCase(),
                message: this.formatMessage(args),
                args: this.serializeArgs(args),
            };

            // 如果启用堆栈跟踪且是错误日志
            if (this.config.enableStackTrace && level === LogLevel.ERROR) {
                logRecord.stack = this.getStackTrace();
            }

            await this.saveLogRecord(logRecord);

            // 检查是否需要上报
            const count = await this.getLogCount();
            if (count >= this.config.maxRecords && !this.isReporting) {
                this.isReporting = true;
                await this.reportAndClearLogs();
            }
        } catch (error) {
            this.internalLogger.error("Failed to record log:", error);
        }
    }

    /**
     * 格式化消息
     */
    private formatMessage(args: any[]): string {
        return args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return arg.message;
            return String(arg);
        }).join(' ');
    }

    /**
     * 序列化参数
     */
    private serializeArgs(args: any[]): any[] {
        return args.map(arg => {
            try {
                if (arg === null || arg === undefined) {
                    return arg;
                }

                if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
                    return arg;
                }

                if (arg instanceof Error) {
                    return {
                        name: arg.name,
                        message: arg.message,
                        stack: arg.stack,
                        __type: 'Error'
                    };
                }

                if (Array.isArray(arg)) {
                    return arg.map(item => this.safeStringify(item));
                }

                if (typeof arg === 'object') {
                    return this.safeStringify(arg);
                }

                return String(arg);
            } catch (error) {
                // @ts-ignore
                return `[Serialization Error: ${error.message}]`;
            }
        });
    }

    /**
     * 安全的JSON序列化
     */
    private safeStringify(obj: any): any {
        const seen = new WeakSet();

        const replacer = (key: string, value: any) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }

            if (typeof value === 'function') {
                return `[Function: ${value.name || 'anonymous'}]`;
            }

            if (value instanceof Date) {
                return { __type: 'Date', value: value.toISOString() };
            }

            if (value instanceof RegExp) {
                return { __type: 'RegExp', value: value.toString() };
            }

            return value;
        };

        try {
            return JSON.parse(JSON.stringify(obj, replacer));
        } catch (error) {
            // @ts-ignore
            return `[Stringify Error: ${error.message}]`;
        }
    }

    /**
     * 获取堆栈跟踪
     */
    private getStackTrace(): string {
        try {
            throw new Error();
        } catch (error) {
            const stack = (error as Error).stack || '';
            const lines = stack.split('\n');
            // 过滤掉插件内部的堆栈信息
            return lines.slice(3).join('\n');
        }
    }

    /**
     * 保存日志记录到IndexedDB
     */
    private async saveLogRecord(record: LogRecord): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const store = transaction.objectStore(this.config.storeName);
            const request = store.add(record);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取日志数量
     */
    private async getLogCount(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(0);
                return;
            }

            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取所有日志记录
     */
    private async getAllLogs(): Promise<LogRecord[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }

            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 清空所有日志记录
     */
    private async clearLogs(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const store = transaction.objectStore(this.config.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 上报并清空日志
     */
    private async reportAndClearLogs(): Promise<void> {
        try {
            this.internalLogger.info("Starting to report logs");

            const logs = await this.getAllLogs();
            if (logs.length === 0) return;

            // 上报数据
            await this.report({
                type: 'logger',
                data: {
                    logs,
                    count: logs.length,
                    reportTime: Date.now(),
                }
            });

            // 清空本地数据
            await this.clearLogs();

            this.internalLogger.info(`Reported and cleared ${logs.length} log records`);
        } catch (error) {
            this.internalLogger.error("Failed to report logs:", error);
        } finally {
            this.isReporting = false;
        }
    }

    /**
     * 关闭数据库连接
     */
    private closeDB(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 手动上报日志
     */
    async manualReport(): Promise<void> {
        try {
            await this.reportAndClearLogs();
        } catch (error) {
            this.internalLogger.error("Manual report failed:", error);
        }
    }

    /**
     * 设置日志等级
     */
    setLogLevel(level: LogLevel): void {
        this.config.logLevel = level;
        this.internalLogger.info(`Log level set to ${LogLevel[level]}`);
    }

    /**
     * 获取当前日志数量
     */
    async getCurrentLogCount(): Promise<number> {
        return await this.getLogCount();
    }

    /**
     * 清空所有日志（不上报）
     */
    async clearAllLogs(): Promise<void> {
        try {
            await this.clearLogs();
            this.internalLogger.info("All logs cleared");
        } catch (error) {
            this.internalLogger.error("Clear logs failed:", error);
        }
    }

    /**
     * 获取Logger实例，供其他插件使用
     */
    getLogger() {
        return this.logger;
    }
}