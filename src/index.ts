import {Monitor} from "./core/Monitor";
import {WebEyeConfig} from "./types";
import {LoggerPlugin, LogLevel} from "./plugins/LoggerPlugin";
import {RequestPlugin} from "./plugins/RequestPlugin";
import {ResourcePlugin} from "./plugins/ResourcePlugin";
import {ErrorPlugin} from "./plugins/ErrorPlugin";

export function initEyeLogs(options: WebEyeConfig): Monitor {
    const monitor = new Monitor(options);

    monitor
        .use(new LoggerPlugin())
        .use(new ErrorPlugin({
            enableBehaviorReport: false,
            enableReactErrorBoundary: true,
        }))
        .use(new RequestPlugin())
        .use(new ResourcePlugin())
        .install();

    return monitor
}