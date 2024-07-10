import {_global, _support, getErrorType, getMd5, on, parseStackError} from "../utils";
import {ErrorTypeEnum, ReportTypeEnum, StackFrameFace, UnKnown} from "../types";
import report from '../report'

export default class HandleListener {
    constructor() {
        this.windowError();
        this.rejectError();
    }

    private windowError() {
        on(_global, "error", (event: ErrorEvent) => {
            if (this.adaptReact()) return true;
            const eventType = getErrorType(event);
            if (eventType === ErrorTypeEnum.RS) {
                // 资源加载异常
                this.resourcesError(event, eventType);
            } else if(eventType === ErrorTypeEnum.CS) {
                // 跨域
                this.resourcesError(event, eventType);
            } else if (eventType === ErrorTypeEnum.JS) {
                this.scriptCodeError(event, eventType);
            }
        }, true);
    }

    // Promise reject 错误监听
    private rejectError() {
        on(_global, "unhandledrejection", (event: PromiseRejectionEvent) => {
            const errorContent: {msg: string, frames?: StackFrameFace[]} = {msg: UnKnown};
            const stacks = parseStackError(event.reason);
            if (stacks?.length) {
                errorContent.msg = stacks[0].source;
                errorContent.frames = stacks;
            } else {
                errorContent.msg = event.reason;
            }
            const id = getMd5(`${errorContent.msg}`);

            report({
                type: ReportTypeEnum.PROMISE,
                data: {
                    id, ...errorContent,
                    status: event?.reason.name || UnKnown,
                },
            });
        });
    }

    // 资源加载错误
    private resourcesError(event: ErrorEvent, type: ErrorTypeEnum) {
        const cTarget = event.target || event.srcElement
        const url = (cTarget as HTMLImageElement).src || (cTarget as HTMLAnchorElement).href;
        const localName = (cTarget as HTMLElement).localName;
        const id = getMd5(`${url}${localName}`);

        report({
            type: ReportTypeEnum.RESOURCES,
            data: {type, id, url, localName},
        });
    }

    // 代码执行错误
    private scriptCodeError(event: ErrorEvent, type: ErrorTypeEnum) {
        const stacks = parseStackError(event.error);
        const {message, filename, lineno, colno} = event;
        const id = getMd5(`${message}${filename}${lineno}${colno}`);

        // 发送事件
        _support.events.emit(ReportTypeEnum.CODE);

        report({
            type: ReportTypeEnum.CODE,
            data: {
                id, msg: message, frames: stacks,
                status: event?.error?.name || UnKnown,
            },
        });
    }

    // 处理 react 开发环境会执行两次
    private adaptReact(): boolean {
        if (((error) => (error.stack && error.stack.indexOf("invokeGuardedCallbackDev") >= 0))(new Error())) {
            return true;
        }
        return false;
    }
}