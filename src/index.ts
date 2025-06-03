import {Monitor} from "./core/Monitor";
import {WebEyeConfig} from "./types";
import {LoggerPlugin, LogLevel} from "./plugins/LoggerPlugin";
import {RequestPlugin} from "./plugins/RequestPlugin";
import {ResourcePlugin} from "./plugins/ResourcePlugin";
import {ErrorPlugin} from "./plugins/ErrorPlugin";
import {CustomPlugin} from "./plugins/CustomPlugin";
import {WhiteScreenPlugin} from "./plugins/WhiteScreenPlugin";
import {PerformancePlugin} from "./plugins/PerformancePlugin";

export function initEyeLogs(options: WebEyeConfig): Monitor {
    const monitor = new Monitor(options);

    monitor
        .use(new LoggerPlugin())
        .use(new WhiteScreenPlugin({
            checkDOMCount: false,
            skipSelectors: ["meta", "head", "script", "style"], // 忽略的元素选择器(checkDOMCount 为 true 时生效)
            whiteScreenDoms: ["#root"],
        }))
        .use(new PerformancePlugin())
        .use(new CustomPlugin())
        .use(new ErrorPlugin({
            enableBehaviorReport: false,      // 启用行为上报
            behaviorDelay: 5000,            // 延迟上报时间(ms) enableBehaviorReport 为 true 时有效
            maxBehaviorRecords: 50,         // 最大行为记录数
            enableSourceMap: true,          // 启用source map解析
            filterErrors: (error) => true   // 错误过滤函数
        }))
        .use(new RequestPlugin())
        .use(new ResourcePlugin())
        .install();

    return monitor
}