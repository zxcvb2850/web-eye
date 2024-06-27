/**
 * 重写系统函数，以便错误收集和监听
 * */
import {_global, _support, getTimestamp, replaceOriginal, on} from "../utils";
import {HttpCallbackEnum, EventTypesEnum} from "../types";
import whiteScreen from "./whiteScreen";
import rrweb from "./rrweb";

export function http() {
    const eventTypeFetch = EventTypesEnum.FETCH;
    const eventTypeXHR = EventTypesEnum.XHR;
    // 重写 fetch
    replaceOriginal(_global, 'fetch', (originalFetch) => {
        return function (url: string, config: Partial<Request> = {}) {
            const startTime = getTimestamp();
            const method = config?.method || "GET";
            const headers = new Headers(config?.headers || {});

            return originalFetch.apply(_global, [url, {config, headers}])
                .then((res: Response) => {
                    const endTime = getTimestamp();
                    const time = endTime - startTime;
                    console.info(`---fetch success ${method} ${url} ${time}ms---`, res);
                    _support.events.emit(eventTypeFetch, {url, method, time}, HttpCallbackEnum.SUCCESS);
                    return res;
                }, (err: Error) => {
                    const endTime = getTimestamp();
                    const time = endTime - startTime;
                    console.info(`---fetch error ${method} ${url} ${time}ms---`, err);
                    _support.events.emit(eventTypeFetch, {url, method, err, time}, HttpCallbackEnum.ERROR);
                    throw err;
                })
        }
    });

    // 重写 XMLHttpRequest
    const originalXHRProto = _global.XMLHttpRequest.prototype;
    replaceOriginal(originalXHRProto, 'open', (originalOpen) => {
        return function (this: XMLHttpRequest, ...args: any[]): void {
            // @ts-ignore
            this.king_web_eye_xhr = {
                method: args[0],
                startTime: getTimestamp(),
                url: args[1],
            }
            originalOpen.apply(this, args);
        }
    });
    replaceOriginal(originalXHRProto, 'send', (originalSend) => {
        return function (this: XMLHttpRequest, ...args: any[]): void {
            // @ts-ignore
            const {method, startTime, url} = this.king_web_eye_xhr;
            on(this, "loadend", () => {
                const endTime = getTimestamp();
                const time = endTime - startTime;
                console.info(`---xhr ${method} ${url} ${time}ms---`, this);
                _support.events.emit(eventTypeXHR, {url, method, time}, HttpCallbackEnum.SUCCESS);
            });

            originalSend.apply(this, args);
        }
    });

    // 白屏检测
    whiteScreen();

    // 操作录制
    rrweb();
}