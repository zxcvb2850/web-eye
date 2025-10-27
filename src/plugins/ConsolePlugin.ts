import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import { IndexedDBManager } from "../utils/indexedDBManager";

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
 * 日志名称
 */
export type LogName = 'debug'| 'log' | 'warn' | 'error';

/**
 * 日志记录接口
 */
interface LogRecord {
    level: LogLevel;
    levelName: string;
    message: string;
    args: string;
    stack?: string;
    timestamp: number;
    url: string;
}

/**
 * Logger插件配置接口
 */
interface ConsoleConfig {
    logLevel: LogLevel;
    maxRecords: number;
    enableStackTrace: boolean;
    showInConsole: boolean | LogName[]; // 是否在控制台中显示日志
    recordInConsole: boolean | LogName[]; // 是否在控制台中记录日志
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
        showInConsole: true,
        recordInConsole: true,
        ignorePatterns: [/\[WebEyeLog\]/],
    };

    private isReporting = false; // 上报标记
    private db?: IndexedDBManager;
    private dbStoreName = 'logs'; // 数据库存储名称
    private originalConsole: Record<string, Function>;

    constructor(config?: Partial<ConsoleConfig>) {
        super();
        this.config = { ...this.config, ...config };

        // 保存原始console方法
        this.originalConsole = {
            debug: console.debug,
            log: console.log,
            warn: console.warn,
            error: console.error,
        };
    }

    protected async init(): Promise<void> {
        this.logger.log(`Init ConsolePlugin`);

        try {
            // 初始化数据库
            this.db = IndexedDBManager.getInstance();
            this.hijackConsole();
        } catch (error) {
            this.logger.error("Failed to initialize ConsolePlugin:", error);
        }
    }

    protected destroy(): void {
        this.restoreConsole();
        this.db?.close?.();
    }

    /**
     * 劫持console方法
     */
    private hijackConsole(): void {
        const methods: { name: LogName; level: LogLevel }[] = [
            { name: 'debug', level: LogLevel.DEBUG },
            { name: 'log', level: LogLevel.LOG },
            { name: 'warn', level: LogLevel.WARN },
            { name: 'error', level: LogLevel.ERROR },
        ];

        methods.forEach(({ name, level }) => {
            const originalMethod = this.originalConsole[name];

            (console as any)[name] = (...args: any[]) => {
                // 根据配置决定是否输出日志
                if (this.config.showInConsole && !(Array.isArray(this.config.showInConsole) && this.config.showInConsole.includes(name))) {
                    originalMethod.apply(console, args);
                }
                
                // 记录日志 不受等级影响
                // 但受 recordInConsole 影响
                if (
                    !!this.config.recordInConsole &&
                    (!Array.isArray(this.config.recordInConsole) || (Array.isArray(this.config.recordInConsole) && this.config.recordInConsole.includes(name))) &&
                    !this.shouldIgnoreLog(args)
                ) {
                    this.recordLog(level, name, args);
                }
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
        Object.entries(this.originalConsole).forEach(([name, method]) => {
            (console as any)[name] = method;
        });
    }

    /**
     * 记录日志到IndexedDB
     */
    private async recordLog(level: LogLevel, levelName: string, args: any[]): Promise<void> {
        if (!this.db?.loaded) return;

        try {
            const logRecord: LogRecord = {
                timestamp: Date.now(),
                level,
                levelName: levelName.toUpperCase(),
                message: this.formatMessage(args),
                args: this.serializeArgs(args),
                url: window.location.href,
            };

            // 如果启用堆栈跟踪且是错误日志
            if (this.config.enableStackTrace && level >= LogLevel.WARN) {
                logRecord.stack = this.captureStackTrace();
            }

            await this.db.add(this.dbStoreName, logRecord);

            // 检查是否需要上报
            await this.checkAndReport();
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
            if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
            if (arg === null) return 'null';
            if (arg === undefined) return 'undefined';
            return String(arg);
        }).join(' ');
    }

    /**
     * 序列化参数
     */
    private serializeArgs(args: any[]): string {
        try {
            const serialized = args.map(arg => this.serializeValue(arg));
            return JSON.stringify(serialized);
        } catch (error) {
            return JSON.stringify([`[Serialization Error: ${error}]`]);
        }
    }
    /**
     * 序列化单个值
     */
    private serializeValue(value: any, depth = 0): any {
        const MAX_DEPTH = 5;
        const MAX_STRING_LENGTH = 500;
        const MAX_ARRAY_LENGTH = 50;
        const MAX_OBJECT_KEYS = 20;

        if (depth > MAX_DEPTH) {
            return "[Max Depth Exceeded]";
        }

        // 处理基础类型
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof value === "string") {
            return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
        }
        if (typeof value === "number" || typeof value === "boolean") {
            return value;
        }
        if (typeof value === "function") {
            return `[Function: ${value.name || 'anonymous'}]`;
        }
        if (typeof value === "symbol") {
            return `[Symbol: ${value.description || 'unknown'}]`;
        }

        /// 处理特殊对象
        // 错误
        if (value instanceof Error) {
            return {
                __type: "Error",
                name: value.name,
                message: value.message,
                stack: value.stack?.substring(0, MAX_STRING_LENGTH),
            }
        }
        // 日期
        if (value instanceof Date) {
            return { __type: "Date", value: value.toISOString() };
        }
        // 正则表达式
        if (value instanceof RegExp) {
            return { __type: "RegExp", value: value.toString() };
        }

        // 处理数组
        if (Array.isArray(value)) {
            const result = value.slice(0, MAX_ARRAY_LENGTH).map(item => this.serializeValue(item, depth + 1));

            if (value.length > MAX_ARRAY_LENGTH) result.push(`[...${value.length - MAX_ARRAY_LENGTH} more items]`);

            return result;
        }

        // 处理对象
        if (typeof value === "object") {
            // 防止循环引用
            if (this.hasCircularReference(value)) return "[Circular Reference]";

            const result:any = {};
            const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);

            for (const key of keys) {
                try {
                    result[key] = this.serializeValue(value[key], depth + 1)
                } catch (error) {
                    result[key] = `[Error: ${error}]`;
                }
            }

            if (Object.keys(value).length > MAX_OBJECT_KEYS) {
                result["..."] = `[${Object.keys(value).length - MAX_OBJECT_KEYS} more keys]`;
            }

            // 添加构造函数信息
            if (value.constructor && value.constructor.name !== "object") {
                result.__constructor = value.constructor.name;
            }

            return result;
        }

        return String(value);
    }
    /**
     * 检查是否有循环引用
     */
    private hasCircularReference(obj: any): boolean {
        const seen = new WeakSet();
        
        function check(current: any): boolean {
            if (current === null || typeof current !== "object") return false;

            if (seen.has(current)) return true;

            seen.add(current);

            for (const key in current) {
                if (current.hasOwnProperty(key) && check(current[key])) {
                    return true;
                }
            }

            return false;
        }

        return check(obj);
    }

    /**
     * 堆栈错误信息
     */
    private captureStackTrace():string {
        try {
            const stack = new Error().stack || '';
            const lines = stack.split('\n');
            // 过滤掉插件内部的堆栈信息
            return lines.slice(4).join('\n');
        } catch (error) {
            return 'Stack trace unavailable';
        }
    }

    /**
     * 检查并上报
     */
    private async checkAndReport(): Promise<void> {
        if (!this.db) return;
        if (this.isReporting) return;

        const count = await this.db.count(this.dbStoreName);
        if (count >= this.config.maxRecords) {
            await this.reportAndClear();
        }
    }

    /**
     * 上报并清空
     */
    private async reportAndClear(): Promise<void> {
        if (!this.db) return;
        if (this.isReporting) return;

        this.isReporting = true;

        try {
            const logs = await this.db.getAll(this.dbStoreName);
            if (logs.length === 0) return;

            this.logger.log(`Reported logs: `, logs);
            await this.report({
                type: MonitorType.CONSOLE,
                data: {
                    logs,
                    count: logs.length,
                    timestamp: Date.now(),
                }
            });

            await this.db.clear(this.dbStoreName);
            this.logger.log(`Reported and cleared ${logs.length} log records`);
        } catch (error) {
            this.logger.error("Failed to report logs:", error);
        } finally {
            this.isReporting = false;
        }
    }

    /**
     * 手动触发上报
     */
    async manualReport(): Promise<void> {
        await this.reportAndClear();
    }

    /**
     * 动态设置日志等级
     */
    setLogLevel(level: LogLevel) {
        this.config.logLevel = level;
    }

    /**
     * 获取Logger实例，供其他插件使用
     */
    getLogger() {
        return this.logger;
    }
}
