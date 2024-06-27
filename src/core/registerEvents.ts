import {Callback, HttpCallbackEnum, EventTypesEnum} from "../types";
import {_support} from "../utils";
import logger from "../logger";
import performance from "./performance";
import {http} from "./http";
import historyRouter from "./historyRouter";

export function registerEvents() {
    // 性能检测
    performance();
    _support.events.on(EventTypesEnum.PERFORMANCE, (args: any) => {
        logger.log(args);
    });

    // 重写http请求
    http();
    _support.events.on(EventTypesEnum.FETCH, (args: any, callbackType: HttpCallbackEnum) => {
        logger.log(args);
    });
    _support.events.on(EventTypesEnum.XHR, (args: any, callbackType: HttpCallbackEnum) => {
        logger.log(args);
    });

    // 监听路由变化
    historyRouter();
    _support.events.on(EventTypesEnum.HISTORY, (args: any) => {
        logger.log(args);
    });
    _support.events.on(EventTypesEnum.HASHCHANGE, (args: any) => {
        logger.log(args);
    });

}

function addHandleEvent(callback: Callback, type: EventTypesEnum) {
    if (type === EventTypesEnum.PERFORMANCE) {
        callback();
        performance();
    }
}