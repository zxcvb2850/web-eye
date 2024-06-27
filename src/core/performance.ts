/**
 * 性能检测
 * */
import {_global, _support, on} from "../utils";
import {EventTypesEnum} from "../types";

function Performance() {
    const eventType = EventTypesEnum.PERFORMANCE;
    // TTFB (Time to First Byte)：从用户发起请求到浏览器接收到第一个字节数据的时间。
    on(_global, "load", () => {
        const [navigationEntry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        if (navigationEntry) {
            console.info("---TTFB---", navigationEntry.responseStart - navigationEntry.requestStart);
            _support.events.emit(eventType, {TTFB: navigationEntry.responseStart - navigationEntry.requestStart});
        }
    })

    // FCP (First Contentful Paint)：页面首次绘制任何内容（文本、图像、SVG 等）的时间。
    new PerformanceObserver((entryList) => {
        const fcpEntry = entryList.getEntriesByName("first-contentful-paint")[0];
        if (fcpEntry) {
            console.info("---FCP---", fcpEntry.startTime);
            _support.events.emit(eventType, {FCP: fcpEntry.startTime});
        }
    }).observe({type: "paint", buffered: true});

    // LCP (Largest Contentful Paint)：页面加载过程中最大可见内容元素绘制完成的时间。
    new PerformanceObserver((entryList) => {
        const lcpEntry = entryList.getEntries()[0];
        if (lcpEntry) {
            console.info("---LCP---", lcpEntry.startTime);
            _support.events.emit(eventType, {LCP: lcpEntry.startTime});
        }
    }).observe({type: "largest-contentful-paint", buffered: true});

    // FID (First Input Delay)：用户第一次与页面交互（如点击按钮）到浏览器响应该交互的时间。
    let firstHiddenTime = document.visibilityState === 'hidden' ? 0 : Infinity;
    on(_global.document, "visibilitychange", (event: Event) => {
        firstHiddenTime = Math.min(firstHiddenTime, event.timeStamp);
    }, {once: true})
    new PerformanceObserver((entryList, po) => {
        entryList.getEntries().forEach(entry => {
            if (entry.startTime < firstHiddenTime) {
                // @ts-ignore
                const fid = entry.processingStart - entry.startTime;
                po.disconnect()
                console.info("---FID---", fid);
                _support.events.emit(eventType, {FID: fid});
            }
        })
    }).observe({type: "first-input", buffered: true});

    // CLS (Cumulative Layout Shift)：页面生命周期内所有意外布局偏移的累计分数。
    let clsValue = 0;
    let clsEntries: any[] = [];
    let sessionValue = 0;
    let sessionEntries: any[] = [];
    new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
                const firstSessionEntry = sessionEntries[0];
                const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
                // 当发生变化后不到1秒，且不到5秒，包括当前会话条目，否则重置会话
                if (
                    sessionValue
                    && entry.startTime - lastSessionEntry.startTime > 1000
                    && entry.startTime - firstSessionEntry.startTime < 5000
                ) {
                    sessionValue += entry.value;
                    sessionEntries.push(entry);
                } else {
                    sessionValue += entry.value;
                    sessionEntries = [entry];
                }
                if (sessionValue > clsValue) {
                    clsValue = sessionValue;
                    clsEntries = sessionEntries;
                }
            }
        })
        console.info("---CLS---", clsValue, clsEntries);
    }).observe({type: "layout-shift", buffered: true});

    // FSP (First Screen Paint) 是指首次屏幕绘制
    new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
            if (entry.name === "first-contentful-paint") {
                console.info("---FSP---", entry.startTime);
                _support.events.emit(eventType, {FSP: entry.startTime});
            }
        })
    }).observe({type: "paint", buffered: true});
}

export default Performance