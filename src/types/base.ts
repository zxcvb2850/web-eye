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
    PERFORMANCE = "performance", // 性能检测
    FETCH = "fetch", // fetch 请求
    XHR = "xhr", // xhr 请求
    CLICK = "click", // 点击事件
    HISTORY = "history", // 路由变化
    HASHCHANGE = "hashchange", // hash 变化
    PROMISE = "promise", // promise
    CODE = "code", // 代码错误
    RESOURCES = "resources", // 资源异常
    WHITE_SCREEN = "whiteScreen", // 白屏检测
    ACTION_RECORD = "action_record", // 录屏
    OTHER = "other", // 其他，预留类型
    CUSTOM = "custom", // 自定义
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

/**
 * 日志工具类，用于打印日志
 * */
export enum LOG_LEVEL_ENUM {
    DEBUG = 1,
    LOG = 2,
    WARN = 3,
    ERROR = 4,
}

/**
 * SDK捕捉上报字段
 * */
export interface ReportSystemDataFace {
    type: ReportTypeEnum;

    data: IAnyObject | string;
}

/**
 * 自定义上报字段
 * */
export interface ReportCustomDataFace {
    event: string | number;

    [key: string]: any;
}
