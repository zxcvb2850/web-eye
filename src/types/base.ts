export interface IAnyObject {
    [key: string]: any
}

export interface Callback {
    (...args: any[]): any;
}

/**
 * 订阅发布事件
 * */
export interface EventsBusFace {
    on: (eventName: string, handler: Function) => void;
    off: (eventName: string, handler: Function) => void;
    emit: (eventName: string, ...args: any[]) => void;
    once: (eventName: string, handler: Function) => void;
    removeAll: (eventName: string) => void;
    clear: () => void;
    size: () => number;
}

/**
 * 枚举错误类型
 * */
export enum HttpCallbackEnum {
    ERROR = "ERROR",
    SUCCESS = "SUCCESS",
    NETWORK = "NETWORK",
}

/**
 * 性能检测枚举
 * */
export enum PerformanceEnum {
    LCP = "LCP",
    FCP = "FCP",
    FSP = "FSP",
    TTFB = "TTFB",
    FID = "FID",
    CLS = "CLS",
}

/**
 * 上报类型
 * */
export enum ReportTypeEnum {
    PERFORMANCE = "performance",
    FETCH = "fetch",
    XHR = "xhr",
    CLICK = "click",
    HISTORY = "history",
    HASHCHANGE = "hashchange",
    PROMISE = "promise",
    CODE = "code",
    RESOURCES = "resources",
}

/**
 * 枚举网络请求错误
 * */
export enum NetworkErrorEnum {
    NETWORK = "network",
    ERROR = "error",
    TIMEOUT = "timeout",
    ABORT = "abort",
    SUCCESS = "success",
}
