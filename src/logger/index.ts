import {
    _global,
    _support, getMd5, getTimestamp,
    indexedDBName,
    indexedStoreConsoleName, parseUrlEncodedBody,
    replaceOriginal,
    typeOf,
    WebIndexedDB
} from "../utils";
import {LOG_LEVEL_ENUM} from "../types";

class Logger {
    private db: WebIndexedDB | null = null;
    private level: LOG_LEVEL_ENUM = LOG_LEVEL_ENUM.LOG;
    private logMethods: { [key: string]: Function } = {
        [LOG_LEVEL_ENUM.DEBUG]: console.debug,
        [LOG_LEVEL_ENUM.LOG]: console.log,
        [LOG_LEVEL_ENUM.WARN]: console.warn,
        [LOG_LEVEL_ENUM.ERROR]: console.error,
    };
    private logMap = new Map<string, number>(); // 记录日志信息
    private isReport = false; // 防止同一时间多次上报
    init() {
        this.db = new WebIndexedDB(indexedDBName, indexedStoreConsoleName);

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
            if (isSystem) {
                this.withConsoleData(level, args);
            }
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

    // 重写 console，用于获取 console 内容
    private hookConsoleMethods(){
        if (_support.options.isConsole) {
            const _this = this;
            const sysConsoles: { [key: string]: Function } = {
                [LOG_LEVEL_ENUM.DEBUG]: console.debug,
                [LOG_LEVEL_ENUM.LOG]: console.log,
                [LOG_LEVEL_ENUM.WARN]: console.warn,
                [LOG_LEVEL_ENUM.ERROR]: console.error,
            };
            for (const key in sysConsoles) {
                replaceOriginal(console, sysConsoles[key].name, (originalConsole) => {
                    return function (this: Console, ...args: any[]){
                        _this.show(parseInt(key), true, ...args);
                    }
                });
            }
        }
    }

    async withConsoleData(level: LOG_LEVEL_ENUM, args: any[]) {
        const logMethods = this.logMethods[level];
        const content = args.map(arg => {
            try {
                const type = typeOf(arg);
                let content = `${type}: `;
                switch(type) {
                    case "number":
                    case "string":
                    case "symbol":
                        content += arg.toString();
                        break;
                    case "error":
                        content += arg.message;
                        break;
                    case "function":
                        content += arg.name;
                        break;
                    case "array":
                    case "object":
                        content += JSON.stringify(arg);
                        break;
                    case "set":
                    case "map":
                        content += (arg?.constructor?.name || arg.name);
                        break;
                    default:
                        content += arg?.toString() || type;
                        break;
                }

                return content;
            } catch (e) {
                return String(e);
            }
        }).join();

        if (this.db) {
            try {
                const {origin, pathname, hash, search} = _global.location
                const data = {
                    level: logMethods.name,
                    time: getTimestamp(),
                    path: `${origin}${pathname}${hash}`,
                    query: parseUrlEncodedBody(search),
                    uuid: _support.uuid,
                    params: _support.params,
                    device: _support.devices,
                    content,
                };
                // 缓存 30s 日志，防止重复上报
                const md5 = getMd5(`${data.level}${data.content}${data.path}${data.query}`);
                if (this.logMap.has(md5)) {
                    const oldTime = this.logMap.get(md5) || 0;
                    if(getTimestamp() - oldTime < 30 * 1000) return;
                }
                this.logMap.set(md5, getTimestamp());
                const count = await this.db.addData(data);
                if (count > 10 && !this.isReport) {
                    this.isReport = true;
                    const result = await this.db.getAllData();
                    this.isReport = false;
                    this.reportConsoleData(result);
                    await this.db.clearData();
                }
            } catch (err) {
                this.warn(`save console indexDB err: `, err);
            }
        }
    }

    reportConsoleData(data: any){
        this.log("===上报 console 信息===", data);
        // reportLogs({
        //     type: ReportTypeEnum.CONSOLE,
        //     data
        // })
    }
}

const instance = new Logger();

export default instance;