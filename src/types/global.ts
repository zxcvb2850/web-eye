import {EventsBusFace} from "./base";

export interface Window {
    __king_web_eye__: KingWebEye;
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
}

export interface KingWebEye {
    name: string;
    version: string;
    /*init(options: OptionsFace);
    setOptions(key:any, value: any);
    setParams(key: any, value: any);*/
    devices: any;
    options: OptionsFace;
    events: EventsBusFace;
    _loop_while_screen_timer_: any;
}