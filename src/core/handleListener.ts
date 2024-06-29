import {_global, on} from "../utils";
import {ReportTypeEnum} from "../types";

export default class HandleListener {
    constructor() {
        this.windowError();
        this.rejectError();
    }

    windowError() {
        on(_global, "error", (event) => {
            if (this.adaptReact()) return true;
            const {message, colno, lineno, filename} = event;
            console.info("---metrics report---", {
                type: ReportTypeEnum.CODE,
                data: {event},
            })
        }, false);
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
    resourcesError() {
    }

    // 代码执行错误
    scriptCodeError() {
    }

    // 处理 react 开发环境会执行两次
    adaptReact(): boolean {
        if (((error) => (error.stack && error.stack.indexOf("invokeGuardedCallbackDev") >= 0))(new Error())) {
            return true;
        }
        return false;
    }
}