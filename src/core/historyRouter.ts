/**
 * 监听路由变化
 * */
import {_global, _support, on, replaceOriginal, getCacheData, setCacheData, localStorageKey} from "../utils";
import {EventTypesEnum} from "../types";

export default function historyRouter() {
    on(_global, "hashchange", (event) => {
        const {oldURL, newURL} = event;
        setCacheData(localStorageKey, newURL);
        console.info("---hashchange old---", oldURL);
        console.info("---hashchange new---", newURL);
        _support.events.emit(EventTypesEnum.HASHCHANGE, {oldPath: oldURL, newPath: newURL});
    })

    const originalHistory = _global.history;
    replaceOriginal(originalHistory, "pushState", (originalPushState) => {
        return function (this: History, ...args: any[]) {
            const {href, origin} = _global.location;
            const newPath = `${origin}${args[2]}`;
            setCacheData(localStorageKey, newPath);
            _support.events.emit(EventTypesEnum.HISTORY, {oldPath: href, newPath: newPath});
            originalPushState.apply(this, args);
        }
    })
    replaceOriginal(originalHistory, "replaceState", (originalReplaceState) => {
        return function (this: History, ...args: any[]) {
            const {href} = _global.location;
            const {value: oldPath, time} = getCacheData(localStorageKey);
            setCacheData(localStorageKey, href);
            _support.events.emit(EventTypesEnum.HISTORY, {oldPath, newPath: href, createTime: time});
            originalReplaceState.apply(this, args);
        }
    })
}