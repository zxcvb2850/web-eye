import {NetworkInfo} from "../types";

/**
 * 生成唯一ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成会话ID
 */
export function generateSessionId(): string {
    let sessionId = sessionStorage.getItem('monitor_session_id');
    if (!sessionId) {
        sessionId = generateId();
        sessionStorage.setItem('monitor_session_id', sessionId);
    }
    return sessionId;
}

/**
 * 节流函数
 * */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;

    return (...args: Parameters<T>) => {
        const currentTime = Date.now();

        if (currentTime - lastExecTime > delay) {
            func(...args);
            lastExecTime = currentTime;
        } else {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                func(...args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime))
        }
    }
}

/**
 * 防抖函数
 * */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(()=> func(...args), delay);
    }
}

/**
 * 深拷贝
 * */
export function deepClone<T>(obj: T): T {
    if (obj === null  || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
        const cloneObj = {} as T;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloneObj[key] = deepClone(obj[key]);
            }
        }
        return cloneObj;
    }

    return obj;
}

/**
 * 解析错误堆栈信息
 * */
export function getErrorStack(error: Error): string {
    return error.stack || error.message || 'Unknown error';
}

/**
 * string 解析 JSON
 * */
export function safeJsonParse<T = any>(str: string, defaultValue: T = {} as T): T {
    try{
        return JSON.parse(str);
    } catch {
      return defaultValue;
    }
}

/**
 * JSON 序列化 string
 * */
export function safeJsonStringify(obj: any, replacer?: (this: any, key: string, value: any) => any): string {
    try {
        return JSON.stringify(obj, replacer as (this: any, key: string, value: any) => any);
    } catch {
        return '{}';
    }
}

/**
 * 获取元素选择器路径
 * */
export function getElementPath(element: Element): string {
    if (!element || element === document.body) return 'body';

    const path: string[] = [];

    while (element && element !== document.body) {
        let selector = element.tagName.toLowerCase();

        if (element.id) {
            selector += `#${element.id}`;
            path.unshift(selector);
            break;
        }

        if (element.className) {
            const classes = element.className.trim().split(/\s+/).join(".");
            if (classes) {
                selector += `.${classes}`;
            }
        }

        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                child => child.tagName === element.tagName
            )
            if (selector.length > 1) {
                const index = siblings.indexOf(element) + 1;
                selector += `:nth-child(${index})`;
            }
        }

        path.unshift(selector);
        element = parent!;
    }

    return path.join(' > ');
}

/**
 * 检查是否为移动设备
 * */
export function isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 获取页面可见性
 * */
export function getPageVisibility(): 'visible' | 'hidden' {
    if (typeof document.hidden !== 'undefined') {
        return document.hidden ? 'hidden' : 'visible';
    }
    return 'visible';
}

/**
 * 等待指定时间
 * */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取网络连接信息
 * */
export function getNetworkInfo(): NetworkInfo | null {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
        return {
            effectiveType: connection.effectiveType || 'unknown',
            downlink: connection.downlink || 0,
            rtt: connection.rtt || 0
        };
    }

    return null;
}

/**
 * 检查是否支持 Web API
 * */
export function isSupported(api: string): boolean {
    try {
        return api in window;
    } catch (e) {
        return false;
    }
}

































