import {Plugin} from "../core/Plugin";

/**
 * 日志等级枚举
 * */
export enum LogLevel {
    DEBUG = 0,
    LOG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4
}

/**
 * 日志类型枚举
 * */
export enum LogType {
    LOG = 'log',
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

/**
 * IndexedDB 存储配置
 * */
interface StoreLogItem {
    id?: number;
    timestamp: number;
    level: LogLevel;
    type: LogType;
    message: string;
    args: any[];
    url: string;
    userAgent: string;
    stackTrace?: string;
}

/**
 * 日志插件配置
 */
interface LoggerConfig {
    level: LogLevel;
    maxLogs: number;
    dbName: string;
    dbVersion: number;
    storeName: string;
}

/**
 * 日志监控插件
 * */
export class LoggerPlugin  extends Plugin {
    name = 'LoggerPlugin'

    private config: LoggerConfig = {
        level: LogLevel.DEBUG,
        maxLogs: 100,
        dbName: 'WebEyeLogDB',
        dbVersion: 1,
        storeName: 'logStore',
    }

    private db: IDBDatabase | null = null;
    private originalConsole: {
        log: typeof console.log;
        debug: typeof console.debug;
        info: typeof console.info;
        warn: typeof console.warn;
        error: typeof console.error;
    } |  null = null;

    // SDK内部调用标识
    private isInternalCall = false;

    protected async init(): Promise<void> {
        console.info("Init LoggerPlugin");

        await this.initIndexedDB();
    }

    protected destroy(): void {
    }

    private async initIndexedDB(): Promise<void> {
        return new Promise((resolve, reject) => {

        })
    }
}