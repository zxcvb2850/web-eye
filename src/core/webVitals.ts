import {afterLoad, getTimestamp} from "../utils";
import {PerformanceEnum, ReportTypeEnum} from "../types";
import logger from "../logger";

interface MetricFace {
    type: string;
    time: number;
    rating: number;
}

export default class WebVitals {
    private startTime: number;
    public metrics: MetricFace[] = [];

    constructor() {
        this.startTime = getTimestamp();
        this.metrics = [];
        this.getFID();
        this.getCLS();
        afterLoad(() => {
            try {
                Promise.all([this.getTTFB(),this.getFCP(), this.getLCP(),this.getFSP()])
                    .then(() => {
                        console.info("---metrics report---", {
                            type: ReportTypeEnum.PERFORMANCE,
                            data: this.metrics
                        });
                    })
            } catch (err) {
                logger.error("get web vitals error: ", err);
            }
        })
    }

    // TTFB (Time to First Byte)：从用户发起请求到浏览器接收到第一个字节数据的时间。
    getTTFB() {
        return new Promise((resolve, reject) => {
            const [navigationEntry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
            if (navigationEntry) {
                this.metrics.push({type: PerformanceEnum.TTFB, time: navigationEntry.responseStart - navigationEntry.requestStart, rating: getTimestamp() - this.startTime});
                resolve(null);
            } else {
                reject("TTFB error");
            }
        })
    }

    // FCP (First Contentful Paint)：页面首次绘制任何内容（文本、图像、SVG 等）的时间。
    getFCP() {
        return new Promise( (resolve, reject) => {
            new PerformanceObserver((entryList) => {
                const fcpEntry = entryList.getEntriesByName("first-contentful-paint")[0];
                if (fcpEntry) {
                    this.metrics.push({type: PerformanceEnum.FCP, time: fcpEntry.startTime, rating: getTimestamp() - this.startTime});
                    resolve(null);
                } else {
                    reject("FCP error");
                }
            }).observe({type: "paint", buffered: true});
        })
    }

    // LCP (Largest Contentful Paint)：页面加载过程中最大可见内容元素绘制完成的时间。
    getLCP() {
        return new Promise((resolve, reject) => {
            new PerformanceObserver((entryList) => {
                const lcpEntry = entryList.getEntries()[0];
                if (lcpEntry) {
                    this.metrics.push({type: PerformanceEnum.LCP, time: lcpEntry.startTime, rating: getTimestamp() - this.startTime});
                    resolve(null);
                } else {
                    reject("LCP error");
                }
            }).observe({type: "largest-contentful-paint", buffered: true});
        })
    }
    // FSP (First Screen Paint) 是指首次屏幕绘制
    getFSP() {
        return new Promise((resolve, reject) => {
            new PerformanceObserver((entryList) => {
                entryList.getEntries().forEach((entry) => {
                    if (entry.name === "first-contentful-paint") {
                        this.metrics.push({type: PerformanceEnum.FSP, time: entry.startTime, rating: getTimestamp() - this.startTime});
                        resolve(null);
                    }
                })
            }).observe({type: "paint", buffered: true});
        })
    }

    // FID (First Input Delay)：用户第一次与页面交互（如点击按钮）到浏览器响应该交互的时间。
    getFID() {
        new PerformanceObserver((entryList, po) => {
            entryList.getEntries().forEach(entry => {
                // @ts-ignore
                const fid = entry.processingStart - entry.startTime;
                po.disconnect()
                console.info("---metrics report---", {
                    type: ReportTypeEnum.PERFORMANCE,
                    data: [{type: PerformanceEnum.FID, time: fid, rating: getTimestamp() - this.startTime}]
                });
            })
        }).observe({type: "first-input", buffered: true});
    }

    // CLS (Cumulative Layout Shift)：页面生命周期内所有意外布局偏移的累计分数。
    getCLS() {
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
            if (clsValue > 2.5) {
                console.info("---metrics report---", {
                    type: ReportTypeEnum.PERFORMANCE,
                    data: [{type: PerformanceEnum.CLS, time: clsValue}]
                });
            }
        }).observe({type: "layout-shift", buffered: true});
    }
}