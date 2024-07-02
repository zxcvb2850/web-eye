import {
    _global,
    _support,
    EventsBus,
    getCacheData,
    getUuid,
    isObject,
    localStorageUUID, on,
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
import WhiteScreen from "./core/whiteScreen";
import ActionRecord from "./core/actionRecord";

/**
 * 入口文件
 * */
class KingWebEye {
    protected _initialized = false; // 是否已经初始化
    public options: OptionsFace;
    public actionRecord: ActionRecord | null = null;

    constructor() {
        this.options = {
            dsn: "",
            appid: "",
            level: LOG_LEVEL_ENUM.LOG,
            isConsole: true,
            maxRecordLimit: 100,
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

    init(options: OptionsFace) {
        if (this._initialized) {
            logger.warn(`Already initialized`);
            return;
        }
        this._initialized = true;

        if (!options.dsn) {
            logger.error(`dsn is must be set`);
            return;
        }
        if (!options.appid) {
            logger.error(`appid is must be set`);
            return;
        }
        validateOptions(options.dsn, "dsn", "string", false) && (this.options.dsn = options.dsn);
        validateOptions(options.appid, "appid", "string", false) && (this.options.appid = options.appid);
        if (validateOptions(options.debug, "debug", "boolean", true)) {
            logger.setLevel(LOG_LEVEL_ENUM.DEBUG);
            this.options.debug = options.debug;
        }
        if (validateOptions(options.level, "level", "number", true)) {
            this.options.level = options.level;
            !this.options.debug && logger.setLevel(options.level as number);
        }
        validateOptions(options.isConsole, "isConsole", "boolean", true) && (this.options.isConsole = options.isConsole);
        if (validateOptions(options.whiteScreenDoms, "whiteScreenDoms", "array", true)) {
            this.options.whiteScreenDoms = options.whiteScreenDoms;
            // 白屏检测
            if (options?.whiteScreenDoms?.length) {
                new WhiteScreen();
            }
        }
        if (validateOptions(options.isActionRecord, "actionRecord", "boolean", true)) {
            this.options.isActionRecord = options.isActionRecord;
            // 是否开启录制
            if (options.isActionRecord) {
                this.actionRecord = new ActionRecord();
            }
        }
        validateOptions(options.maxRecordLimit, "maxRecordLimit", "number", true) && (this.options.maxRecordLimit = options.maxRecordLimit)

        // 初始化日志
        logger.init();

        // 请求监听
        new HttpProxy();

        // 浏览器关闭/刷新前触发的回调
        on(_global, "beforeunload", (event: Event) => {
            // 关闭前如果有延迟上报的，则执行立即上报
            if (_support._report_delay_timer) {
                _support.events.emit("report_song");
            }
        })
    }

    setOptions(key: keyof OptionsFace, value: OptionsFace[keyof OptionsFace]) {
        if (key === "dsn" || key === "appid") {
            logger.warn(`Unable to set ${key} field`);
            return false;
        }
        if (this.options.hasOwnProperty(key)) {
            if (key === "debug" && validateOptions(value, key, "boolean", false)) {
                if (value === false && this.options.level != null) {
                    logger.setLevel(this.options.level);
                } else if (value === true) {
                    logger.setLevel(LOG_LEVEL_ENUM.DEBUG);
                }
            }
            if (!this.options.debug && key === "level" && validateOptions(value, key, "number", false)) {
                logger.setLevel(value as number);
            }

            if (key === "isActionRecord" && value === false && this.actionRecord?.stopRecord) {
                this.actionRecord.stopRecord();
            }

            (this.options[key] as OptionsFace[keyof OptionsFace]) = value;
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
