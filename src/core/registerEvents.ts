import {HttpCallbackEnum, EventTypesEnum} from "../types";
import {_support} from "../utils";
import logger from "../logger";
import performance from "./performance";
import {httpProxy} from "./httpProxy";
import historyRouter from "./historyRouter";
import WebPerformance from "../webPerformance";

export function registerEvents() {
    // 性能检测
    Promise.all([performance.getLCP(), performance.getFCP(), performance.getFSP(), performance.getTTFB()]).then((res: any[]) => {
        const eventType = EventTypesEnum.PERFORMANCE;
        console.info("---eventType---", eventType);
        console.info("---Promise res---", res);
        console.info("---_support---", JSON.stringify(_support.params));
        console.info("---devices---", JSON.stringify(_support.devices));
    })

    // 重写http请求
    httpProxy();
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