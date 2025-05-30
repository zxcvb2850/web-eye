import {Monitor} from "./core/Monitor";
import {WebEyeConfig} from "./types";
import {LoggerPlugin} from "./plugins/LoggerPlugin";
import {RequestPlugin} from "./plugins/RequestPlugin";
import {ResourceErrorPlugin} from "./plugins/ResourceErrorPlugin";

console.info("==================================")

export function initEyeLogs(options: WebEyeConfig): Monitor {
    const monitor = new Monitor(options);
    monitor.install();
    monitor.use(new LoggerPlugin());
    monitor.use(new RequestPlugin());
    monitor.use(new ResourceErrorPlugin());

    return monitor
}