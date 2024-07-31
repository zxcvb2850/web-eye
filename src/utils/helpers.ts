import { Window, Callback, OptionsFace, IAnyObject } from '../types';
import { isType, typeOf } from './typeOf';
import logger from '../logger';

/**
 * 验证 options 的合法性
 * @param value 需要验证的值
 * @param key 需要验证的 key
 * @param target 需要验证的类型
 * @param isNull 是否允许为 null
 * @returns {boolean} 验证结果
 * */
export const validateOptions = (
  value: OptionsFace[keyof OptionsFace],
  key: string,
  target: string,
  isNull = false,
): boolean => {
  if (isNull && value == null) return false;
  const isValid = isType(value, target);
  if (!isValid) {
    logger.error(`${key} must be ${target}, now ${key} is ${typeOf(key)}`);
  }
  return isValid;
};

/**
 * 重新对象的某个属性
 * @param original 原对象
 * @param replaceFn 替换属性
 * @param callbackOriginal 将原始函数作为参数 回调
 * @param isForced 是否强制替换
 * */
export function replaceOriginal(
  original: IAnyObject,
  replaceFn: string,
  callbackOriginal: Callback,
  isForced = false,
): void {
  if (original === undefined) return;
  if (replaceFn in original || isForced) {
    const originalFn = original[replaceFn];
    const callback = callbackOriginal(originalFn);

    if (typeof callback === 'function') {
      original[replaceFn] = callback;
    }
  }
}

type EventMap<T extends EventTarget> = T extends Window
  ? WindowEventMap
  : T extends XMLHttpRequest
    ? XMLHttpRequestEventMap
    : T extends HTMLElement
      ? HTMLElementEventMap
      : never;
/**
 * 统一监听事件
 * @param target 监听目标
 * @param type 监听类型
 * @param listener 监听回调
 * @param options 监听配置
 * */
export function on<T extends EventTarget, K extends keyof EventMap<T>>(
  target: { addEventListener: Function },
  type:
    | keyof GlobalEventHandlersEventMap
    | keyof XMLHttpRequestEventTargetEventMap
    | keyof WindowEventMap
    | keyof DocumentEventMap,
  listener: (this: T, ev: EventMap<T>[K]) => any,
  options?: boolean | AddEventListenerOptions,
): void {
  target.addEventListener(type, listener, options);
}
