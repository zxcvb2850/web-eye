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
 * 监听事件枚举
 * */
export enum EventTypesEnum {
    PERFORMANCE = "performance",
    FETCH = "fetch",
    XHR = "xhr",
    CLICK = "click",
    HISTORY = "history",
    HASHCHANGE = "hashchange",
}