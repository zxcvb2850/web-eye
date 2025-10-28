/**
 * 性能监控
 * */
import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

interface PerformanceConfig {
    isOpenLCP?: boolean;
    isOpenINP?: boolean;
    isOpenFCP?: boolean;
    isOpenCLS?: boolean;
    isOpenTTFB?: boolean;
}

export class PerformancePlugin extends Plugin {
    name = 'PerformancePlugin';

    private config: PerformanceConfig = {
        isOpenLCP: true,
        isOpenINP: true,
        isOpenFCP: true,
        isOpenCLS: true,
        isOpenTTFB: true,
    };

    constructor(config: Partial<PerformanceConfig>) {
        super();
        this.config = { ...this.config, ...config };
    }


    protected init(): void {
        this.logger.log('Init PerformancePlugin');

        this.config.isOpenLCP && this.collectLCP();
        this.config.isOpenINP && this.collectINP();
        this.config.isOpenFCP && this.collectFCP();
        this.config.isOpenCLS && this.collectCLS();
        this.config.isOpenTTFB && this.collectTTFB();
    }

    protected destroy(): void {
        this.logger.log('Destroy PerformancePlugin')
    }

    /**
     * 衡量加载性能（LCP）
     * */
    private collectLCP() {
        onLCP(metric => {
            const {id, name, value, rating, navigationType} = metric;
            this.report({
                type: MonitorType.PERFORMANCE,
                data: {id, name, value, rating, navigationType, timestamp: Date.now()},
            })
        });
    }

    /**
     * 衡量互动性（INP）
     * */
    private collectINP() {
        onINP(metric => {
            const {id, name, value, rating, navigationType} = metric;
            this.report({
                type: MonitorType.PERFORMANCE,
                data: {id, name, value, rating, navigationType, timestamp: Date.now()},
            })
        });
    }

    /**
     * 首次内容渲染 (FCP)
     * */
    private collectFCP() {
        onFCP(metric => {
            const {id, name, value, rating, navigationType} = metric;
            this.report({
                type: MonitorType.PERFORMANCE,
                data: {id, name, value, rating, navigationType, timestamp: Date.now()},
            })
        });
    }

    /**
     * 衡量视觉稳定性（CLS）
     * */
    private collectCLS() {
        onCLS(metric => {
            const {id, name, value, rating, navigationType} = metric;
            this.report({
                type: MonitorType.PERFORMANCE,
                data: {id, name, value, rating, navigationType, timestamp: Date.now()},
            })
        });
    }

    /**
     * 首次发送字节时间 (TTFB)
     * */
    private collectTTFB() {
        onTTFB(metric => {
            const {id, name, value, rating, navigationType} = metric;
            this.report({
                type: MonitorType.PERFORMANCE,
                data: {id, name, value, rating, navigationType, timestamp: Date.now()},
            })
        });
    }
}
