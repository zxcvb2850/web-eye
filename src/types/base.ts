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

// 未知错误类型
export const UnKnown = "UnKnown";

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
    OTHER = "other",
    WHITE_SCREEN = "whiteScreen",
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


/**
 * 枚举监听错误类型
 * */
export enum ErrorTypeEnum {
    JS = "js", // JS 代码错误类型
    RS = "resources", // 资源错误 - 加载失败
    XML = "xml", // 请求错误
    CS = "cors", // 请求错误 - 跨域
    REACT = "react" , // react ErrorBoundary 错误边界
}

/**
 * 枚举性能评分
 * */
export enum RatingEnum {
    GD = 'good',
    NI = 'needs-improvement',
    PR = 'poor',
}

/**
 * 堆栈错误结构
 * */
export interface StackFrameFace {
    source: string,
    fileName: string,
    lineno: number,
    colno: number;
    functionName?: string,
}
