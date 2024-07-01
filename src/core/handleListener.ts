import {_global, getErrorType, on} from "../utils";
import {ErrorTypeEnum, ReportTypeEnum} from "../types";

export default class HandleListener {
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
        console.log("---error source---", url, (cTarget as HTMLElement).localName, event);
    }

    // 代码执行错误
    scriptCodeError(event: ErrorEvent) {
        console.log("---error code---", event, event.message, event.filename, event.lineno, event.colno, event.error);
    }

    // 处理 react 开发环境会执行两次
    adaptReact(): boolean {
        if (((error) => (error.stack && error.stack.indexOf("invokeGuardedCallbackDev") >= 0))(new Error())) {
            return true;
        }
        return false;
    }
}