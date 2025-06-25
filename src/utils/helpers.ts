import {Callback, IAnyObject} from "../types";

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

/**
 * 添加事件监听器
 * */
export function addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
): void {
    target.addEventListener(type, listener, options);
}

/**
 * 移除事件监听器
 * */
export function removeEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions
): void {
    target.removeEventListener(type, listener, options);
}
