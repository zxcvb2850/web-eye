import {_global, _support, EventsBus, getCacheData, localStorageUUID, on, setCacheData, validateOptions} from "./utils";
import {IAnyObject, OptionsFace} from "./types";
import logger, {LOG_LEVEL_ENUM} from "./logger";
import {registerEvents} from "./core/registerEvents";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

/**
 * 入口文件
 * */
class KingWebEye {
    public options: OptionsFace;
    public params: IAnyObject;
    constructor() {
        this.options = {
            dsn: "",
            appid: "",
            level: LOG_LEVEL_ENUM.LOG,
            isConsole: true,
        };

        this.params = {};

        _support.options = this.options;
        _support.events = new EventsBus();

        on(_global, "DOMContentLoaded", async () => {
            const {value} = getCacheData(localStorageUUID);
            if (value) {
                this.setParams("uuid", value);
            } else {
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                if (result?.visitorId) {
                    setCacheData(localStorageUUID, result.visitorId);
                    this.setParams("uuid", result.visitorId);
                }
            }
        })
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

        registerEvents();
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
        this.params[key] = value;
    }
}

const instance = new KingWebEye();

_global.__king_web_eye__ = Object.assign(instance, _support);

export default instance;
