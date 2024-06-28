import {
    _global,
    _support,
    EventsBus,
    getCacheData,
    isObject,
    localStorageUUID,
    setCacheData,
    validateOptions
} from "./utils";
import {OptionsFace} from "./types";
import logger, {LOG_LEVEL_ENUM} from "./logger";
import {registerEvents} from "./core/registerEvents";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import ReportSend from "./core/reportSend";
import WebVitals from "./webVitals";
import HttpProxy from "./httpProxy";

/**
 * 入口文件
 * */
class KingWebEye {
    public options: OptionsFace;
    constructor() {
        this.options = {
            dsn: "",
            appid: "",
            level: LOG_LEVEL_ENUM.LOG,
            isConsole: true,
        };

        _support.options = this.options;
        _support.events = new EventsBus();
        _support.report = new ReportSend();

        const {value} = getCacheData(localStorageUUID);
        if (value) {
            this.setParams("uuid", value);
        } else {
            FingerprintJS.load()
                .then(fp => fp.get())
                .then(result => {
                    if (result?.visitorId) {
                        setCacheData(localStorageUUID, result.visitorId);
                        this.setParams("uuid", result.visitorId);
                    }
                });
        }

        // WEB性能上报
        new WebVitals();
    }

    init (options: OptionsFace){
        if (!options?.dsn) logger.error("dsn is required");
        if (!options?.appid) logger.error("appid is required");
        validateOptions(options.dsn, "dsn", "string") && (this.options.dsn = options.dsn);
        validateOptions(options.appid, "appid", "string") && (this.options.appid = options.appid);
        if(options.level != null && validateOptions(options.level, "level", "number")) {
            this.options.level = options.level;
            logger.setLevel(options.level as number);
        }
        if(options.isConsole != null && validateOptions(options.isConsole, "isConsole", "boolean")) {
            this.options.isConsole = options.isConsole;
        }
        // 初始化日志
        logger.init();

        // 请求监听
        new HttpProxy();
    }
    setOptions(key: keyof OptionsFace, value: OptionsFace[keyof OptionsFace]) {
        if (this.options.hasOwnProperty(key)) {
            if (key === "level" && value != null && validateOptions(value, key, "number")) {
                logger.setLevel(value as number);
            } else {
                (this.options[key] as OptionsFace[keyof OptionsFace]) = value;
            }
        }
    }
    setParams(key: any, value: any) {
        if (!isObject(_support.params)) {
            _support.params = {};
        }
        _support.params[key] = value;
    }
}

const instance = new KingWebEye();

_global.__king_web_eye__ = Object.assign(instance, _support);

export default instance;
