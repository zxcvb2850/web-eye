/**
 * 性能监控
 * */
import { Plugin } from "../core/Plugin";
import { MonitorType } from "../types";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

export class PerformancePlugin extends Plugin {
    name = 'PerformancePlugin';

    protected init(): void {
        this.logger.log('Init PerformancePlugin');

        this.collectLCP();
        this.collectINP();
        this.collectFCP();
        this.collectCLS();
        this.collectTTFB();
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
                data: {id, name, value, rating, navigationType},
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
                data: {id, name, value, rating, navigationType},
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
                data: {id, name, value, rating, navigationType},
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
                data: {id, name, value, rating, navigationType},
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
                data: {id, name, value, rating, navigationType},
            })
        });
    }
}