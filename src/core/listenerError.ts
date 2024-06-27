import {_support, on} from "../utils";

export default function listenerError() {
    on(window, "error", (event: ErrorEvent) => {
        const { message, filename, lineno, colno, error } = event;
        // 过滤掉React开发环境的错误
        if (
            ((error) =>
                    error.stack && error.stack.indexOf("invokeGuardedCallbackDev") >= 0
            )(new Error())) {
            return true;
        }
        console.info("---web-eye error---", message);
    }, false);

    on(window, "unhandledrejection", (event: PromiseRejectionEvent) => {
        console.info("---web-eye unhandledrejection---", event);
    });
}