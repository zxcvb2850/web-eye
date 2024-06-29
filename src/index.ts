import {
    _global,
    _support,
    EventsBus,
    getCacheData, getUuid,
    isObject,
    localStorageUUID,
    setCacheData,
    validateOptions
} from "./utils";
import {OptionsFace, ParamsFace} from "./types";
import logger, {LOG_LEVEL_ENUM} from "./logger";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import WebVitals from "./core/webVitals";
import HttpProxy from "./core/httpProxy";
import HistoryRouter from "./core/historyRouter";
import HandleListener from "./core/handleListener";

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

        if (!isObject(_support.params)) {
            _support.params = {};
        }
        // 浏览器指纹
        const {value} = getCacheData(localStorageUUID);
        if (value) {
            _support.params["visitorId"] = value;
        } else {
            FingerprintJS.load()
                .then(fp => fp.get())
                .then(result => {
                    if (result?.visitorId) {
                        setCacheData(localStorageUUID, result.visitorId);
                        _support.params["visitorId"] = result.visitorId;
                    }
                });
        }
        // 本次uuid
        const uuid = getUuid();
        if (uuid) _support.params["uuid"] = uuid;

        // WEB性能上报
        new WebVitals();
        // 路由监听
        new HistoryRouter();
        // 全局监听错误
        new HandleListener();
    }

    init (options: OptionsFace){
        console.info("----------------------------");
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
    setParams(key: keyof ParamsFace, value: any) {
        if (key === "visitorId" || key === "uuid") {
            logger.warn(`Unable to set ${key} field`);
            return false;
        }
        _support.params[key] = value;
    }
}

const instance = new KingWebEye();

_global.__king_web_eye__ = Object.assign(instance, _support);

export default instance;
