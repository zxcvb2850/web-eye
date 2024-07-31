import md5 from 'crypto-js/md5';
import * as pako from 'pako';
import { _global, isString, isRegExp } from '../utils';
import { Callback, ErrorTypeEnum, StackFrameFace } from '../types';
import logger from '../logger';

export const docScreenW = () =>
  _global.document.documentElement?.clientWidth ||
  _global.document.body.clientWidth;
export const docScreenH = () =>
  _global.document.documentElement?.clientHeight ||
  _global.document.body.clientHeight;

// 获取当前时间
export const getTimestamp = (): number => {
  return new Date().getTime();
};

// 分割
const splitStr = '|||';

// 设置缓存数据
export function setCacheData(
  key: string,
  value: string,
  time = getTimestamp(),
): void {
  const data = `${value}${splitStr}${time}`;
  _global.localStorage.setItem(key, data);
}

// 获取缓存数据
export function getCacheData(key: string): {
  value: string | null;
  time: number;
} {
  const data = _global.localStorage.getItem(key);
  if (data && data.indexOf(splitStr) > -1) {
    const [value, time] = data.split(splitStr);
    return { value, time: Number(time) };
  }

  return { value: data, time: 0 };
}

/**
 * 监听页面加载完成
 * @param {Callback} callback
 */
export const afterLoad = (callback: Callback): void => {
  if (document.readyState === 'complete') {
    callback();
  } else {
    window.addEventListener('pageshow', callback, {
      once: true,
      capture: true,
    });
  }
};

/**
 * 获取域名相关数据
 * */
export const getDomainUrl = (url: string): URL => {
  return new URL(url, window.location.origin); // 使用 window.location.origin 处理相对URL
};

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
};

/**
 * 解析 URL 编码的请求体
 * */
export const parseUrlEncodedBody = (
  body: string,
): { [key: string]: string } => {
  const params = new URLSearchParams(body);
  const parsedBody: { [key: string]: string } = {};
  params.forEach((value, key) => {
    parsedBody[key] = value;
  });
  return parsedBody;
};

/**
 * 请求 Headers Key 驼峰写法
 * */
export const formatHeadersKey = (headersKey: string): string => {
  return headersKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
};

/**
 * 生成 UUID
 * */
export const getUuid = (): string => {
  let timestamp = new Date().getTime();
  let perforNow =
    (typeof performance !== 'undefined' &&
      performance.now &&
      performance.now() * 1000) ||
    0;
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
};

/**
 * 判断是js异常、静态资源异常还是跨域异常
 * @param {(ErrorEvent | Event)} event
 * @return {*}
 */
export const getErrorType = (event: ErrorEvent | Event) => {
  const isJsError = event instanceof ErrorEvent;
  if (!isJsError) return ErrorTypeEnum.RS;
  return event.message === 'Script error.'
    ? ErrorTypeEnum.CS
    : ErrorTypeEnum.JS;
};

/**
 * 获取MD5，用于上报唯一值，防止重复上报
 * */
export const getMd5 = (input: string): string => {
  if (isString(input)) {
    return md5(input).toString();
  }
  logger.warn('please pass in string type');
  return '';
};

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

  return { colno, lineno, fileName, functionName, source: line };
}

/**
 * 错误堆栈提取信息
 * @param {any} error 错误信息
 * @param {number} maxLen 堆栈获取最大数量
 * @return {StackFrameFace[]} 错误堆栈
 * */
export function parseStackError(error: any, maxLen = 5): StackFrameFace[] {
  const { stack } = error;
  // 不符合堆栈错误的直接返回
  if (!CHROME_IE_STACK_REGEXP.test(stack) || !stack?.length) return [];
  const frames: any[] = [];
  const stacks = error.stack
    .split('\n')
    .filter((line: string) => !!line.match(ERROR_CONTENT_LINE_REG));
  const len = stacks.length > maxLen ? maxLen : stacks.length;
  for (let i = 0; i < len; i++) {
    if (i >= STACKS_LIMIT) break;
    const frame = parseStackLine(stacks[i]);
    if (frame) {
      frames.push(frame);
    }
  }
  return frames;
}

/**
 * 节流
 * */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
): T {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;

  return function (this: any, ...args: Parameters<T>) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = getTimestamp();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (getTimestamp() - lastRan >= limit) {
            func.apply(this, args);
            lastRan = getTimestamp();
          }
        },
        limit - (getTimestamp() - lastRan),
      );
    }
  } as T;
}

/**
 * 防抖
 * */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
): T {
  let lastFunc: ReturnType<typeof setTimeout>;

  return function (this: any, ...args: Parameters<T>) {
    if (lastFunc) {
      clearTimeout(lastFunc);
    }

    lastFunc = setTimeout(() => {
      func(...args);
    }, limit);
  } as T;
}

/**
 * JSON转字符串
 */
export function jsonToString(data: any) {
  if (!data) return data;
  try {
    return JSON.stringify(data);
  } catch (err) {
    logger.warn(err);
    return data;
  }
}

// 是否可以转为 json 对象
export function isJsonString(str: string) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

/**
 * 字符串转JSON
 */
export function stringToJSON(data: any) {
  if (!data) return data;

  return isJsonString(data) ? JSON.parse(data) : data;
}

/**
 * 压缩数据
 * */
export function zip(data: any) {
  if (!data) return data;
  try {
    const dataJsonStr = isString(data) ? data : jsonToString(data);
    return pako.gzip(dataJsonStr);
  } catch (err) {
    logger.warn(err);
    return data;
  }
}

/**
 * 过滤白名单函数
 *
 * @param filterList 过滤列表，包含字符串或正则表达式
 * @param str 待过滤的字符串
 * @returns 如果字符串包含过滤列表中的任一元素（字符串或正则表达式匹配），则返回true；否则返回false
 */
export function filterWhiteList(filterList: (string | RegExp)[], str: string) {
  // filterHttpUrl 中可能会有正则, 字符串
  for (let i = 0; i < filterList.length; i++) {
    const filter = filterList[i];
    if (isString(filter)) {
      // 字符串
      if (str.indexOf(filter) !== -1) return true;
    } else if (isRegExp(filter)) {
      // 正则
      if (filter.test(str)) return true;
    }
  }
  return false;
}
