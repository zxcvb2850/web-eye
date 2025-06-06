/**
 * 任意对象
 * */
export interface IAnyObject {
    [key: string]: any;
}

/**
 * 回调函数
 * */
export interface Callback {
    (original: any): any;
}

// 监控配置接口
export interface WebEyeConfig  {
    debug?: boolean;
    appKey: string;
    reportUrl: string;
    logLevel: LogLevel;
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

// 基础监控数据接口
export interface BaseMonitorData {
    appKey: string; // 上报KEY
    type: MonitorType; // 错误类型
    visitorId: string; // 指纹ID
    sessionId: string; // 会话ID
    data: IAnyObject; // 所上报的数据
    deviceInfo: DeviceInfo; // 设备信息
    extends: ExtendInfo; // 拓展信息
}

// 扩展信息接口
export interface ExtendInfo {
    [key: string]: any;
}

//  监控数据类型枚举
export enum MonitorType {
    PERFORMANCE = 'performance',
    REQUEST = 'request',
    ERROR = 'error',
    ROUTE = 'route',
    BEHAVIOR = 'behavior',
    RECORD = 'record',
    WHITE_SCREEN = 'white_screen',
    RESOURCE = 'resource',
    CODE = 'code',
    CUSTOM = 'custom',
}

// 设备信息接口
export interface DeviceInfo {
    url: string;
    userAgent: string;
    language: string;
    platform: string;
    screen: {
        width: number;
        height: number;
    },
    viewport: {
        width: number;
        height: number;
    };
    timestamp: number;
    connection?: NetworkInfo | null;
}

// 网络状态接口
export interface NetworkInfo {
    effectiveType: string;
    downlink: number;
    rtt: number;
}

// 请求监控数据
export interface RequestData extends BaseMonitorData {
    type: MonitorType.REQUEST;
    data: {
        url: string;
        method: string;
        status: number;
        duration: number;
        requestSize?: number;
        responseSize?: number;
        success: boolean;
        errorMessage?: string;
        isCorsError?: boolean;
        requestHeaders?: Record<string, string>;
        responseHeaders?: Record<string, string>;
        requestParams?: Record<string, any>;
        timestamp: number;
    };
}

// 错误监控数据
export interface ErrorData extends BaseMonitorData {
    type: MonitorType.ERROR;
    data: {
        message: string;
        stack?: string;
        filename?: string;
        lineno?: number;
        colno?: number;
        errorType: ErrorType;
        componentStack?: string;
        props?: Record<string, any>;
    };
}

// 错误类型枚举
export enum ErrorType {
    JAVASCRIPT = 'javascript',
    PROMISE = 'promise',
    RESOURCE = 'resource',
    REACT = 'react',
    VUE = 'vue',
}

// 插件接口
export interface IPlugin {
    name: string;
    install(monitor: any): void;
    uninstall(): void;
}

// 上报器接口
export interface IReporter {
    report(data: BaseMonitorData | BaseMonitorData[]): Promise<void>;
    flush(): Promise<void>;
}

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

// 日志打印接口
export interface ILogger {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    debug(...args: any[]): void;
}

// 监控数据联合类型
export type MonitorData =
    | RequestData
    | ErrorData;

































