import md5 from "crypto-js/md5";
import {_global, isString} from "../utils";
import {Callback, ErrorTypeEnum, IAnyObject, StackFrameFace} from "../types";
import logger from "../logger";

// 获取当前时间
export const getTimestamp = (): number => {
    return new Date().getTime()
}

// 记录最后一次的路由
export const localStorageRouter = "_king_web_eye_router_";
// 保存用户的UUID
export const localStorageUUID = "_king_web_eye_uuid_";
// 分割
const splitStr = "|||";

// 设置缓存数据
export function setCacheData(key: string, value: string, time = getTimestamp()): void{
    const data = `${value}${splitStr}${time}`;
    _global.localStorage.setItem(key, data);
}

// 获取缓存数据
export function getCacheData(key: string): {value: string | null, time: number} {
    const data = _global.localStorage.getItem(key);
    if(data && data.indexOf(splitStr) > -1){
        const [value, time] = data.split(splitStr);
        return {value, time: Number(time)};
    }

    return {value: data, time: 0};
}


/**
 * 监听页面加载完成
 * @param {Callback} callback
 */
export const afterLoad = (callback: Callback): void => {
    if (document.readyState === 'complete') {
        callback();
    } else {
        window.addEventListener('pageshow', callback, { once: true, capture: true });
    }
};

/**
 * GET请求地址获取参数
 * */
export const getDomainFromUrl = (url: string): IAnyObject => {
    const str = "/x?a=1&b=2";

    const domain = new URL(url);

    console.info("===get url===", domain);

    return {};
}

/**
 * 获取域名相关数据
 * */
export const getDomainUrl = (url: string): URL => {
    return new URL(url, window.location.origin); // 使用 window.location.origin 处理相对URL
}

/**
 * 获取查询参数
 * */
export const getQueryParams = (url: string): { [key: string]: string } => {
    const params: { [key: string]: string } = {};
    const parsedUrl = getDomainUrl(url);
    parsedUrl.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

/**
 * 解析 URL 编码的请求体
 * */
export const parseUrlEncodedBody = (body: string): { [key: string]: string } => {
    const params = new URLSearchParams(body);
    const parsedBody: { [key: string]: string } = {};
    params.forEach((value, key) => {
        parsedBody[key] = value;
    });
    return parsedBody;
}

/**
 * 请求 Headers Key 驼峰写法
 * */
export const formatHeadersKey = (headersKey: string): string => {
    return headersKey.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-');
}


/**
 * 生成 UUID
 * */
export const getUuid = (): string => {
    let timestamp = new Date().getTime();
    let perforNow = (typeof performance !== 'undefined' && performance.now && performance.now() * 1000) || 0;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        let random = Math.random() * 16;
        if (timestamp > 0) {
            random = (timestamp + random) % 16 | 0;
            timestamp = Math.floor(timestamp / 16);
        } else {
            random = (perforNow + random) % 16 | 0;
            perforNow = Math.floor(perforNow / 16);
        }
        return (c === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
}

/**
 * 判断是js异常、静态资源异常还是跨域异常
 * @param {(ErrorEvent | Event)} event
 * @return {*}
 */
export const getErrorType = (event: ErrorEvent | Event) => {
    const isJsError = event instanceof ErrorEvent;
    if (!isJsError) return ErrorTypeEnum.RS;
    return event.message === 'Script error.' ? ErrorTypeEnum.CS : ErrorTypeEnum.JS;
};

/**
 * 获取MD5，用于上报唯一值，防止重复上报
 * */
export const getMd5 = (input: string): string => {
    if (isString(input)) {
        return md5(input).toString();
    }
    logger.warn("please pass in string type");
    return "";
}

const CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;

// 正则表达式，用以解析堆栈split后得到的字符串
const ERROR_CONTENT_LINE_REG =
    /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|chrome-extension|address|native|eval|webpack|<anonymous>|[-a-z]+:|.*bundle|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;

// 限制只追溯10个
const STACKS_LIMIT = 5;

// 解析每一行
export function parseStackLine(line: string): StackFrameFace | null {
    const lineMatch = line.match(ERROR_CONTENT_LINE_REG);
    if (!lineMatch) return null;
    const fileName = lineMatch[2];
    const functionName = lineMatch[1];
    const lineno = parseInt(lineMatch[3], 10) || undefined;
    const colno = parseInt(lineMatch[4], 10) || undefined;
    if (!(lineno && colno)) return null;

    return {colno, lineno, fileName, functionName, source: line};
}

/**
 * 错误堆栈提取信息
 * @param {any} error 错误信息
 * @return {StackFrameFace[]} 错误堆栈
 * */
export function parseStackError(error: any): StackFrameFace[] {
    const { stack } = error;
    // 不符合堆栈错误的直接返回
    if (!CHROME_IE_STACK_REGEXP.test(stack) || !stack?.length) return [];
    const frames: any[] = [];
    const stacks = error.stack.split('\n').filter((line: string) => !!line.match(ERROR_CONTENT_LINE_REG));
    for (let i = 0; i < stacks.length; i++) {
        if (i >= STACKS_LIMIT) break;
        const frame = parseStackLine(stacks[i]);
        if (frame) {
            frames.push(frame);
        }
    }
    return frames;
}
