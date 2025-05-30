import {DeviceInfo} from "../types";
import {getNetworkInfo} from "./common";

/**
 * 获取设备信息
 * */
export function getDeviceInfo(): DeviceInfo {
    const { innerWidth, innerHeight, screen } = window;

    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: screen.width,
        screenHeight: screen.height,
        viewport: { width: innerWidth, height: innerHeight },
        connection: getNetworkInfo(),
    }
}
/**
 * 获取浏览器信息
 * */
export function getBrowserInfo() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isEdge = userAgent.includes('edge');
    const isChrome = userAgent.includes('chrome') && !isEdge;
    const isFirefox = userAgent.includes('firefox');
    const isSafari = userAgent.includes('safari') && !isChrome && !isEdge;
    const isIE = userAgent.includes('trident') || userAgent.includes('msie');

    let browser = 'unknown';
    let version = 'unknown';

    if (isChrome) {
        browser = 'chrome';
        const match = userAgent.match(/chrome\/(\d+)/);
        version = match ? match[1] : 'unknown';
    } else if (isFirefox) {
        browser = 'firefox';
        const match = userAgent.match(/firefox\/(\d+)/);
        version = match ? match[1] : 'unknown';
    } else if (isSafari) {
        browser = 'safari';
        const match = userAgent.match(/version\/(\d+)/);
        version = match ? match[1] : 'unknown';
    } else if (isEdge) {
        browser = 'edge';
        const match = userAgent.match(/edge\/(\d+)/);
        version = match ? match[1] : 'unknown';
    } else if (isIE) {
        browser = 'ie';
        const match = userAgent.match(/(msie|rv:)\s*(\d+)/);
        version = match ? match[2] : 'unknown';
    }

    return { userAgent, browser, version };
}

/**
 * 获取操作系统信息
 */
export function getOSInfo() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    let os = 'unknown';
    let version = 'unknown';

    if (userAgent.includes('Windows NT')) {
        os = 'Windows';
        const match = userAgent.match(/Windows NT (\d+\.\d+)/);
        version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('Mac OS X')) {
        os = 'macOS';
        const match = userAgent.match(/Mac OS X (\d+[._]\d+[._]\d+)/);
        version = match ? match[1].replace(/_/g, '.') : 'unknown';
    } else if (userAgent.includes('Linux')) {
        os = 'Linux';
    } else if (userAgent.includes('Android')) {
        os = 'Android';
        const match = userAgent.match(/Android (\d+\.\d+)/);
        version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        os = 'iOS';
        const match = userAgent.match(/OS (\d+_\d+)/);
        version = match ? match[1].replace(/_/g, '.') : 'unknown';
    }

    return { os, version, platform };
}

/**
 * 获取内存信息
 */
export function getMemoryInfo() {
    const memory = (performance as any).memory;

    if (memory) {
        return {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
    }

    return null;
}

/**
* 获取CPU核心数
*/
export function getCPUInfo() {
    return {
        cores: navigator.hardwareConcurrency || 1
    };
}

/**
 * 获取完整的设备环境信息
 */
export function getFullDeviceInfo() {
    return {
        ...getDeviceInfo(),
        browser: getBrowserInfo(),
        os: getOSInfo(),
        memory: getMemoryInfo(),
        cpu: getCPUInfo()
    };
}















































