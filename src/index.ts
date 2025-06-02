import {Monitor} from "./core/Monitor";
import {WebEyeConfig} from "./types";
import {LoggerPlugin} from "./plugins/LoggerPlugin";
import {RequestPlugin} from "./plugins/RequestPlugin";
import {ResourcePlugin} from "./plugins/ResourcePlugin";
import {ErrorPlugin} from "./plugins/ErrorPlugin";

console.info("==================================")

export function initEyeLogs(options: WebEyeConfig): Monitor {
    const monitor = new Monitor(options);

    monitor
        .use(new LoggerPlugin())
        .use(new ErrorPlugin())
        .use(new RequestPlugin())
        .use(new ResourcePlugin())
        .install();

    return monitor
}