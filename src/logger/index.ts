import {_support} from "../utils/global";
import {replaceOriginal} from "../utils";

/**
 * 日志工具类，用于打印日志
 * */
export enum LOG_LEVEL_ENUM {
    DEBUG = 1,
    LOG = 2,
    WARN = 3,
    ERROR = 4,
}

class Logger {
    private level: LOG_LEVEL_ENUM = LOG_LEVEL_ENUM.LOG;
    private logMethods: { [key: string]: Function } = {
        [LOG_LEVEL_ENUM.DEBUG]: console.debug,
        [LOG_LEVEL_ENUM.LOG]: console.log,
        [LOG_LEVEL_ENUM.WARN]: console.warn,
        [LOG_LEVEL_ENUM.ERROR]: console.error,
    };
    init() {
        this.hookConsoleMethods();
    }
    setLevel(level: LOG_LEVEL_ENUM) {
        this.level = level;
    }

    private isCurrentLevel(level: LOG_LEVEL_ENUM) {
        return level >= this.level;
    }

    private show(level: LOG_LEVEL_ENUM, isSystem = false, ...args: any[]) {
        if (this.isCurrentLevel(level)) {
            const logMethods = this.logMethods[level];
            logMethods(`${isSystem ? "": `【${_support.name}】 `}`, ...args);
        }
    }

    log(...args: any[]) {
        this.show(LOG_LEVEL_ENUM.LOG, false, ...args);
    }

    error(...args: any[]) {
        this.show(LOG_LEVEL_ENUM.ERROR, false, ...args);
    }

    warn(...args: any[]) {
        this.show(LOG_LEVEL_ENUM.WARN, false, ...args);
    }

    debug(...args: any[]) {
        this.show(LOG_LEVEL_ENUM.DEBUG, false, ...args);
    }

    hookConsoleMethods(){
        if (_support.options.isConsole) {
            const _this = this;
            for (const key in this.logMethods) {
                replaceOriginal(console, this.logMethods[key].name, (originalConsole) => {
                    return function (this: Console, ...args: any[]){
                        _this.show(parseInt(key), true, ...args);
                    }
                });
            }
        }
    }
}

const instance = new Logger();

export default instance;