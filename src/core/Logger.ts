import {ILogger, LogLevel} from "../types";

/**
 * SDK 日志配置
 */
export interface LoggerConfig {
    debug?: boolean | undefined;
    logLevel: LogLevel;
    prefix: string;
}

/**
 * 日志类
 */
export class Logger implements ILogger {
    private config: LoggerConfig;

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

    constructor(config: Partial<LoggerConfig>) {
        this.config = {
            logLevel: config.debug ? LogLevel.DEBUG : (config.logLevel || LogLevel.WARN),
            prefix: "[WebEyeLog]",
            ...config,
        };

        // 保存原始 console 方法，确保不被其他代码劫持
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console),
        };
    }
    
    /**
     * 设置日志等级
     */
    setLevel(level: LogLevel): void {
        this.config.logLevel = level;
    }

    /**
     * 获取当前日志等级
     */
    getLevel(): LogLevel {
        return this.config.logLevel;
    }

    /**
     * DEBUG 级别日志
     */
    debug(...args: any[]): void {
        this.show('debug', ...args);
    }

    /**
     * log 级别日志
     */
    log(...args: any[]): void {
        this.show('log', ...args);
    }

    /**
     * WARN 级别日志
     */
    warn(...args: any[]): void {
        this.show('warn', ...args);
    }

    /**
     * ERROR 级别日志
     */
    error(...args: any[]): void {
        this.show('error', ...args);
    }

    /**
     * 展示日志
     */
    show(key: keyof typeof this.originalConsole, ...args: any[]): void {
        if (this.config.logLevel > LogLevel[key.toUpperCase() as keyof typeof LogLevel]) {
            return;
        }

        this.originalConsole[key](this.config.prefix, ...args);
    }

    protected async init(): Promise<void> {
        this.internalLogger.info(`Init LoggerPlugin`);
    }
}
