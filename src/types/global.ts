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

export interface OptionsFace {
    dsn: string;
    appid: string;
    isConsole?: boolean;
    level?: number;
    isPlayback?: boolean;
    debug?: boolean;
    whiteScreenDoms?: string[]; // 白屏检测需要查询的DOM节点
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