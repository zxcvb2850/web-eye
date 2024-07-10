import {onTTFB, onFCP, onLCP, onFID, onCLS} from "web-vitals";
import {_global, afterLoad, getTimestamp} from "../utils";
import {PerformanceEnum, RatingEnum, ReportTypeEnum, Callback} from "../types";
import report from '../report';
import logger from '../logger';

interface MetricFace {
    name: PerformanceEnum;
    value: number;
    rating: string;
}

export default class WebVitals {
    private startTime: number;
    public metrics: MetricFace[] = [];

    constructor() {
        this.startTime = getTimestamp();
        this.metrics = [];

        this.getFID(this.report);
        this.getCLS(this.report);
        afterLoad(() => {
            this.getTTFB(this.report);
            this.getFCP(this.report);
            this.getLCP(this.report);
            this.getFSP(this.report);
        })
    }

    report (data: MetricFace) {
        logger.log({ type: ReportTypeEnum.PERFORMANCE, data });

        report({ type: ReportTypeEnum.PERFORMANCE, data });
    }

    // TTFB (Time to First Byte)：从用户发起请求到浏览器接收到第一个字节数据的时间。
    getTTFB(callback: Callback) {
        if (this.isWebVitalsSupported()) {
            onTTFB((metric) => {
                callback({name: PerformanceEnum.TTFB, value: metric.value, rating: metric.rating});
            })
        } else {
            const [navigationEntry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
            if (navigationEntry) {
                const rating = navigationEntry.responseStart < 800 ? RatingEnum.GD : navigationEntry.responseStart < 1800 ? RatingEnum.NI : RatingEnum.PR;

                callback({name: PerformanceEnum.TTFB, value: navigationEntry.responseStart, rating})
            }
        }
    }

    // FCP (First Contentful Paint)：页面首次绘制任何内容（文本、图像、SVG 等）的时间。
    getFCP(callback: Callback) {
        if (this.isWebVitalsSupported()) {
            onFCP((metric) => {
                callback({ name: PerformanceEnum.FCP, value: metric.value, rating: metric.rating });
            })
        } else {
            new PerformanceObserver((entryList) => {
                const fcpEntry = entryList.getEntriesByName("first-contentful-paint")[0];
                if (fcpEntry) {
                    const rating = fcpEntry.startTime < 2000 ? RatingEnum.GD : fcpEntry.startTime < 3000 ? RatingEnum.NI : RatingEnum.PR;

                    callback({ name: PerformanceEnum.FCP, value: fcpEntry.startTime, rating });
                }
            }).observe({type: "paint", buffered: true});
        }
    }

    // LCP (Largest Contentful Paint)：页面加载过程中最大可见内容元素绘制完成的时间。
    getLCP(callback: Callback) {
        if (this.isWebVitalsSupported()) {
            onLCP((metric) => {
                callback({ name: PerformanceEnum.LCP, value: metric.value, rating: metric.rating });
            })
        } else {
            new PerformanceObserver((entryList) => {
                const lcpEntry = entryList.getEntries()[0];
                if (lcpEntry) {
                    const rating = lcpEntry.startTime < 2500 ? RatingEnum.GD : lcpEntry.startTime < 4000 ? RatingEnum.NI : RatingEnum.PR;

                    callback({ name: PerformanceEnum.LCP, value: lcpEntry.startTime, rating });
                }
            }).observe({type: "largest-contentful-paint", buffered: true});
        }
    }
    // FSP (First Screen Paint) 是指首次屏幕绘制
    getFSP(callback: Callback) {
        new PerformanceObserver((entryList) => {
            entryList.getEntries().forEach((entry) => {
                if (entry.name === "first-contentful-paint") {
                    const rating = entry.startTime < 2500 ? RatingEnum.GD : entry.startTime < 4000 ? RatingEnum.NI : RatingEnum.PR;

                    callback({ name: PerformanceEnum.FSP, value: entry.startTime, rating });
                }
            })
        }).observe({type: "paint", buffered: true});
    }

    // FID (First Input Delay)：用户第一次与页面交互（如点击按钮）到浏览器响应该交互的时间。
    getFID(callback: Callback) {
        if (this.isWebVitalsSupported()) {
            onFID((metric) => {
                callback({ name: PerformanceEnum.FID, value: metric.value, rating: metric.rating });
            }, {reportAllChanges: true});
        } else {
            new PerformanceObserver((entryList, po) => {
                entryList.getEntries().forEach(entry => {
                    // @ts-ignore
                    const fid = entry.processingStart - entry.startTime;
                    let rating = fid < 100 ? RatingEnum.GD : fid < 300 ? RatingEnum.NI : RatingEnum.PR;
                    po.disconnect();

                    callback({ name: PerformanceEnum.FID, value: fid, rating });
                })
            }).observe({type: "first-input", buffered: true});
        }
    }

    // CLS (Cumulative Layout Shift)：页面生命周期内所有意外布局偏移的累计分数。
    getCLS(callback: Callback) {
        if (this.isWebVitalsSupported()) {
            onCLS((metric) => {
                callback({ name: PerformanceEnum.CLS, value: metric.value, rating: metric.rating });
            })
        } else {
            interface LayoutShiftEntry extends PerformanceEntry {
                value: number;
                hadRecentInput: boolean;
            }

            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const layoutShiftEntry = entry as LayoutShiftEntry;
                    // 只有当没有最近输入（如点击、滚动等）时，才计算 CLS
                    if (!layoutShiftEntry.hadRecentInput) {
                        const rating = layoutShiftEntry.value < 0.1 ? RatingEnum.GD : layoutShiftEntry.value < 0.25 ? RatingEnum.NI : RatingEnum.PR;

                        callback({ name: PerformanceEnum.CLS, value: layoutShiftEntry.value, rating });
                    }
                }
            }).observe({ type: 'layout-shift', buffered: true });
        }
    }

    private isWebVitalsSupported(): boolean {
        return 'PerformanceObserver' in _global &&
            'PerformanceEntry' in _global &&
            'getEntriesByType' in Performance.prototype;
    }
}