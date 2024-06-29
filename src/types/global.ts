import {EventsBusFace, IAnyObject} from "./base";

export interface Window {
    __king_web_eye__: KingWebEye;
    screen: any;
    document: Document;
    addEventListener: EventListener;
    removeEventListener: EventListener;
    fetch: any;
    XMLHttpRequest: any;
    history: History;
    location: Location;
    localStorage: Storage;
    innerWidth: number;
    innerHeight: number;
}

export interface KingWebEye {
    name: string;
    version: string;
    devices: any;
    options: OptionsFace;
    params: IAnyObject,
    events: EventsBusFace;
    report: any;
    _loop_while_screen_timer_: any;
}

export interface OptionsFace {
    dsn: string;
    appid: string;
    isConsole?: boolean;
    level?: number;
    isPlayback?: boolean;
    debug?: boolean;
    whiteScreenDoms?: string[]; // 白屏检测需要查询的DOM节点
}

// 自定义参数
export interface ParamsFace {
    visitorId: string; // 浏览器指纹
    uuid: string; // 本次启动的唯一值，避免用户使用多窗口的方式
    [key: string]: any; // 自定义额外字段
}