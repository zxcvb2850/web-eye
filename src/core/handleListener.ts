import {_global, getErrorType, getMd5, getTimestamp, on} from "../utils";
import {ErrorTypeEnum, ReportTypeEnum} from "../types";

export default class HandleListener {
    private reportMap = new Map<string, number>();

    constructor() {
        this.windowError();
        this.rejectError();
    }

    windowError() {
        on(_global, "error", (event: ErrorEvent) => {
            if (this.adaptReact()) return true;
            console.info("---event instanceof ErrorEvent---", event instanceof ErrorEvent);
            if (getErrorType(event) === ErrorTypeEnum.SR) {
                this.resourcesError(event);
            } else if(getErrorType(event) === ErrorTypeEnum.JS) {
                this.scriptCodeError(event);
            }
            console.info("---metrics report---", {
                type: ReportTypeEnum.CODE,
                data: {event},
            })
        }, true);
    }

    // Promise reject 错误监听
    rejectError() {
        on(window, "unhandledrejection", (event: PromiseRejectionEvent) => {
            console.info("---metrics report---", {
                type: ReportTypeEnum.PROMISE,
                data: {event},
            })
        });
    }

    // 资源加载错误
    resourcesError(event: ErrorEvent) {
        const cTarget = event.target || event.srcElement
        const url = (cTarget as HTMLImageElement).src || (cTarget as HTMLAnchorElement).href;
        const localName = (cTarget as HTMLElement).localName;
        const id = getMd5(`${url}${localName}`);
        const isReport = this.setReportRecord(id);
        console.log("---error source---", id, isReport, url, localName);
    }

    // 代码执行错误
    scriptCodeError(event: ErrorEvent) {
        const {message, error, filename, lineno, colno} = event;
        const id = getMd5(`${message}${filename}${lineno}${colno}`);
        const isReport = this.setReportRecord(id);
        console.log("---error code---", id, isReport, event.message, event.filename, event.lineno, event.colno, event.error);
    }

    setReportRecord(id: string): boolean {
        const nowTime = getTimestamp();
        const oldTime = this.reportMap.get(id);
        // 60s 内不重复上报
        const isOk = !(oldTime && nowTime - oldTime < 60 * 1000);
        if (isOk) {
            this.reportMap.set(id, nowTime);
        }
        return isOk;
    }

    // 处理 react 开发环境会执行两次
    adaptReact(): boolean {
        if (((error) => (error.stack && error.stack.indexOf("invokeGuardedCallbackDev") >= 0))(new Error())) {
            return true;
        }
        return false;
    }
}