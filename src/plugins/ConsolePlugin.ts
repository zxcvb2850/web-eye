import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import {IndexedDBManager} from "../utils/indexedDBManager";

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
    level: LogLevel;
    levelName: string;
    message: string;
    args: any[];
    stack?: string;
    timestamp: number;
}

/**
 * Logger插件配置接口
 */
interface ConsoleConfig {
    logLevel: LogLevel;
    maxRecords: number;
    enableStackTrace: boolean;
    ignorePatterns: (RegExp|string)[]; // 忽略日志的正则表达式
}

/**
 * 日志监控插件
 */
export class ConsolePlugin extends Plugin {
    name = 'ConsolePlugin';

    private config: ConsoleConfig = {
        logLevel: LogLevel.DEBUG,
        maxRecords: 100,
        enableStackTrace: true,
        ignorePatterns: [/\[WebEyeLog\]/],
    };

    private isReporting: boolean = false; // 上报标记
    private db: IndexedDBManager;
    private readonly originalConsole: {
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
        debug: typeof console.debug;
    };

    constructor(config?: Partial<ConsoleConfig>) {
        super();
        this.config = { ...this.config, ...config };

        // 保存原始console方法
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
        };

        this.db = new IndexedDBManager({
            storeName: 'logs',
            version: 2,
            keyPath: 'id',
            autoIncrement: true,
            indexes: [
                { name: 'timestamp', keyPath: 'timestamp', unique: false },
                { name: 'level', keyPath: 'level', unique: false }
            ],
        })
    }

    protected async init(): Promise<void> {
        this.logger.log(`Init LoggerPlugin`);

        try {
            await this.db.init();
            this.hijackConsole();
        } catch (error) {
            this.logger.error("Failed to initialize ConsolePlugin:", error);
        }
    }

    protected destroy(): void {
        this.restoreConsole();
        this.db.close();
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
                if (method === 'info' || this.shouldIgnoreLog(args)) {
                    return;
                }

                // 记录日志
                this.recordConsoleLog(level, method, args);
            };
        });
    }

    /**
     * 检查是否应该忽略这条日志
     */
    private shouldIgnoreLog(args: any[]): boolean {
        const message = this.formatMessage(args);

        return this.config.ignorePatterns.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(message);
            }
            return pattern === message;
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
    private async recordConsoleLog(level: LogLevel, levelName: string, args: any[]): Promise<void> {
        if (!this.db) return;

        try {
            const logRecord: LogRecord = {
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

            await this.db.add(logRecord);

            // 检查是否需要上报
            const count = await this.db.count();
            if (count >= this.config.maxRecords && !this.isReporting) {
                this.isReporting = true;
                await this.reportAndClearLogs();
            }
        } catch (error) {
            this.logger.error("Failed to record log:", error);
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
     * 上报并清空日志
     */
    private async reportAndClearLogs(): Promise<void> {
        try {
            this.logger.log("Starting to report logs");

            const logs = await this.db.getAll();
            if (logs.length === 0) return;

            // 上报数据
            await this.report({
                type: MonitorType.CONSOLE,
                data: {
                    logs,
                    count: logs.length,
                    timestamp: Date.now(),
                }
            });

            // 清空本地数据
            await this.db.clear();

            this.logger.log(`Reported and cleared ${logs.length} log records`);
        } catch (error) {
            this.logger.error("Failed to report logs:", error);
        } finally {
            this.isReporting = false;
        }
    }

    /**
     * 手动上报日志
     */
    async manualReport(): Promise<void> {
        try {
            await this.reportAndClearLogs();
        } catch (error) {
            this.logger.error("Manual report failed:", error);
        }
    }

    /**
     * 设置日志等级
     */
    setLogLevel(level: LogLevel): void {
        this.config.logLevel = level;
        this.logger.log(`Log level set to ${LogLevel[level]}`);
    }

    /**
     * 获取当前日志数量
     */
    async getCurrentLogCount(): Promise<number> {
        return await this.db.count();
    }

    /**
     * 清空所有日志（不上报）
     */
    async clearAllLogs(): Promise<void> {
        try {
            await this.db.close();
            this.logger.log("All logs cleared");
        } catch (error) {
            this.logger.error("Clear logs failed:", error);
        }
    }

    /**
     * 获取Logger实例，供其他插件使用
     */
    getLogger() {
        return this.logger;
    }
}
