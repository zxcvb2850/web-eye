import {_global, _support, getCacheData, localStorageRouter, on, replaceOriginal, setCacheData} from "../utils";
import {ReportTypeEnum} from "../types";

export default class HistoryRouter {
    constructor() {
        this.handleHashChange();
        this.proxyHistory();
    }

    handleHashChange(){
        on(_global, "hashchange", (event) => {
            const {oldURL, newURL} = event;
            setCacheData(localStorageRouter, newURL);
            console.info("---hashchange---", {
                type: ReportTypeEnum.HASHCHANGE,
                data: {old: oldURL, new: newURL}
            })
        })
    }

    proxyHistory(){
        const originalHistory = _global.history;
        replaceOriginal(originalHistory, "pushState", (originalPushState) => {
            return function (this: History, ...args: any[]) {
                const {href, origin} = _global.location;
                const newPath = `${origin}${args[2]}`;
                setCacheData(localStorageRouter, newPath);
                console.log("---pushState---", {
                    type: ReportTypeEnum.HISTORY,
                    data: {old: href, new: newPath},
                })
                originalPushState.apply(this, args);
            }
        })
        replaceOriginal(originalHistory, "replaceState", (originalReplaceState) => {
            return function (this: History, ...args: any[]) {
                const {href} = _global.location;
                const {value: oldPath, time} = getCacheData(localStorageRouter);
                setCacheData(localStorageRouter, href);
                console.log("---pushState---", {
                    type: ReportTypeEnum.HISTORY,
                    data: {old: oldPath, new: href},
                })
                originalReplaceState.apply(this, args);
            }
        })
    }
}