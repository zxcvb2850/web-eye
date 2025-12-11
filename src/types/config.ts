/**
 * 日志等级枚举
 */
export enum LogLevel {
    DEBUG = 0,
    LOG = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4, // 不输出任何日志
}

/**
 * 扩展信息接口
 */
export interface ExtendInfo {
    [key: string]: any;
}

/**
 * 监控配置接口
 */
export interface WebEyeConfig  {
    debug?: boolean;
    appKey: string;
    reportUrl: string;
    logLevel?: LogLevel;
    maxRetry?: number; // 上报异常，最大重试次数
    retryDelay?: number; // 上报异常，重试间隔
    enableHash?: boolean;
    enableHistory?: boolean;
    whiteScreenThreshold?: number;
    performanceThreshold?: number;
    enableAutoReport?: boolean; // 是否定时上报
    batchSize?: number;
    flushInterval?: number; // 定时上报间隔
    extends?: ExtendInfo; // 扩展信息
}
