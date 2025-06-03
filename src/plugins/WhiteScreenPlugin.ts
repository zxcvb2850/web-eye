import { Plugin } from "../core/Plugin";
import { LoggerPlugin } from "./LoggerPlugin";
import { debounce, isSupported } from "../utils/common";
import { MonitorType } from "../types";

// 检测结果接口
interface DetectionResult {
    isWhiteScreen: boolean;
    reason: string;
    details: {
        domCount: number;
        textNodes: number;
        imageNodes: number;
        colorSamples: Array<{ x: number; y: number; color: string }>;
        timestamp: number;
    };
}

// 白屏检测配置接口
interface WhiteScreenConfig {
    timeout: number; // 首次检测间隔（ms）
    threshold: number; // 白屏判定阈值（ms）
    sampleCount: number; // 采样点数量
    checkImages: boolean; // 是否检测图片
    checkText: boolean; // 是否检测文本
    checkDOMCount: boolean; // 是否检测DOM节点数量
    minDDOMCount: number; // 最小DOM节点数量
    colorThreshold: number; // 白屏像素颜色阈值（0-255）
    skipSelectors: string[]; // 跳过的选择器
    whiteScreenDoms: string[]; // 检测节点是否存在
    enableMutationObserver: boolean; // 是否启用MutationObserver
    delayCheck: number; // 延迟检测（ms）
}

/**
 * 白屏检测插件
 * */
export class WhiteScreenPlugin extends Plugin {
    name = 'WhiteScreenPlugin';

    private config: WhiteScreenConfig = {
        timeout: 5000,
        threshold: 1000,
        sampleCount: 9,
        checkImages: true,
        checkText: true,
        checkDOMCount: true,
        minDDOMCount: 10,
        colorThreshold: 240,
        skipSelectors: [],
        whiteScreenDoms: [],
        enableMutationObserver: false,
        delayCheck: 2000,
    }

    private timer: NodeJS.Timeout | null = null;
    private observer: MutationObserver | null = null;
    private isChecking = false;
    private lastDetectionTime = 0;
    private whiteScreenStartTime = 0;
    private hasReported = false;
    private logger: any;

    constructor(config?: Partial<WhiteScreenConfig>) {
        super();
        this.config = {...this.config, ...config};
    }

    protected init(): void {
        // 获取Logger实例
        const loggerPlugin = this.monitor.getPlugin('LoggerPlugin') as LoggerPlugin;
        this.logger = loggerPlugin?.getLogger() || console;

        this.logger.log('Init WhiteScreenPlugin');

        // 等待页面基本加载完成后开始检测
        if (document.readyState === 'complete') {
            this.addEventListener(document, 'DOMContentLoaded', () => {
                setTimeout(() => this.startDetection(), this.config.delayCheck);
            });
        } else {
            setTimeout(() => this.startDetection(), this.config.delayCheck);
        }

        if (this.config.enableMutationObserver) {
            this.setupMutationObserver();
        }
    }

    protected destroy(): void {
        this.stopDetection();
        this.destroyMutationObserver();
    }

    /**
     * 设置 DOM 变化监听器
     * */
    private setupMutationObserver(): void {
        if (!isSupported('MutationObserver')){
            this.logger.warn(`Init MutationObserver failed ====>`, 'MutationObserver is not supported.');
            return;
        }

        this.observer = new MutationObserver((mutations) => {
            // 如果 DOM 发生变化，重置白屏开始时间
            const hasSignificantChange = mutations.some(mutation =>
                mutation.type === 'childList' &&
                (mutation.addedNodes.length ||  mutation.removedNodes.length)
            );

            if (hasSignificantChange) {
                this.whiteScreenStartTime = 0;
                this.hasReported = false;
            }
            this.triggerDetection();
        })

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
        });
    }

    /**
     * DOM 变化触发检测（防抖）
     * */
    private triggerDetection = debounce(() => {
        this.performDetection();
    }, 2000)

    /**
     * 销毁 MutationObserver
     * */
    private destroyMutationObserver(): void  {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * 开始检测
     * */
    private startDetection(): void {
        if (this.timer) return;

        // 立即执行一次检测
        this.performDetection();

        // 设置 this.config.interval 检测
        this.timer = setTimeout(() => {
            this.performDetection();
        }, this.config.timeout);
    }

    /**
     * 停止检测
     * */
    private stopDetection(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * 执行检测
     * */
    private async performDetection(): Promise<void> {
        if (this.isChecking) return ;
        this.isChecking = true;

        try {
            const result = await this.detectWhiteScreen();
            this.handleDetectionResult(result);
        } catch (err) {
            this.logger.error(`Perform detection failed ====>`, err);
        } finally {
          this.isChecking = false;
        }
    }

    /**
     * 白屏检测方法
     * */
    private async detectWhiteScreen(): Promise<DetectionResult> {
        const now = Date.now();

        const result: DetectionResult = {
            isWhiteScreen: false,
            reason: '',
            details: {
                domCount: 0,
                textNodes: 0,
                imageNodes: 0,
                colorSamples: [],
                timestamp: now,
            },
        }

        // 1.检测 DOM 节点数量
        if (this.config.checkDOMCount) {
            const domCount = this.getDOMCount();
            result.details.domCount = domCount;

            if (domCount < this.config.minDDOMCount) {
                result.isWhiteScreen = true;
                result.reason = `DOM 节点数量过少: ${domCount} < ${this.config.minDDOMCount}`;
                return result;
            }
        }

        // 2.检测文本内容
        if (this.config.checkText) {
            const textNodes = this.getTextNodeCount();
            result.details.textNodes = textNodes;

            if (textNodes === 0) {
                result.isWhiteScreen = true;
                result.reason = '页面无文本内容';
                return result;
            }
        }

        // 3.检测图片
        if (this.config.checkImages) {
            const imageNodes = this.getImageCount();
            result.details.imageNodes = imageNodes;
        }

        // 4.检测是否有可见元素
        const hasVisibleElements = this.hasVisibleElements();
        if (!hasVisibleElements) {
            result.isWhiteScreen = true;
            result.reason = '页面无可见元素';
            return result;
        }

        // 5.检测指定节点是否存在
        if (this.config.whiteScreenDoms?.length) {
            const isHasDom = this.getWhiteScreenDoms();
            if (!isHasDom) {
                result.isWhiteScreen = true;
                result.reason = '页面未找到指定节点';
                return result;
            }
        }

        return result;
    }

    /**
     * 获取DOM节点数量
     */
    private getDOMCount(): number {
        const allElements = document.querySelectorAll('*');

        // 过滤掉不需要统计的元素
        let count = 0;
        for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i];
            const tagName = element.tagName.toLowerCase();

            if (!this.config.skipSelectors.includes(tagName)) {
                count++;
            }
        }

        return count;
    }

    /**
     * 获取文本节点数量
     */
    private getTextNodeCount(): number {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // 过滤掉只包含空白字符的文本节点
                    const text = node.textContent?.trim() || '';
                    return text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let count = 0;
        while (walker.nextNode()) {
            count++;
        }

        return count;
    }

    /**
     * 获取图片数量
     */
    private getImageCount(): number {
        const images = document.querySelectorAll('img');
        let loadedImages = 0;

        images.forEach(img => {
            if (img.complete && img.naturalHeight > 0) {
                loadedImages++;
            }
        });

        return loadedImages;
    }

    /**
     * 检测是否有可见元素
     */
    private hasVisibleElements(): boolean {
        const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
            if (this.config.skipSelectors.includes(el.tagName.toLowerCase())) {
                return false;
            }

            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0;
        });

        return visibleElements.length > 0;
    }

    /**
     * 检测指定节点是否存在
     * */
    private getWhiteScreenDoms(): boolean {
        const isHas = this.config.whiteScreenDoms.every(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements?.length === 0) {
                this.logger.warn(`WhiteScreenPlugin: No element found with selector: ${selector}`);
            }
            return elements?.length
        });

        return isHas
    }

    /**
     * 处理检测结果
     */
    private handleDetectionResult(result: DetectionResult): void {
        const now = Date.now();

        if (result.isWhiteScreen) {
            // 如果是白屏，记录开始时间
            if (this.whiteScreenStartTime === 0) {
                this.whiteScreenStartTime = now;
                this.logger.warn('WhiteScreenPlugin: White screen detected, starting timer');
            }

            // 检查是否超过阈值
            const duration = now - this.whiteScreenStartTime;
            if (duration >= this.config.threshold && !this.hasReported) {
                this.reportWhiteScreen(result, duration);
                this.hasReported = true;
            }
        } else {
            // 如果不是白屏，重置状态
            if (this.whiteScreenStartTime > 0) {
                this.logger.log('WhiteScreenPlugin: White screen recovered');
                this.whiteScreenStartTime = 0;
                this.hasReported = false;
            }
        }

        this.lastDetectionTime = now;
    }

    /**
     * 上报白屏事件
     */
    private reportWhiteScreen(result: DetectionResult, duration: number): void {
        this.logger.error('WhiteScreenPlugin: White screen detected and reported', result);

        this.safeExecute(() => {
            this.report({
                type: MonitorType.WHITE_SCREEN,
                data: {
                    ...result,
                    duration
                }
            });
        });
    }

    /**
     * 手动触发检测
     */
    async manualDetect(): Promise<DetectionResult> {
        return await this.detectWhiteScreen();
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<WhiteScreenConfig>): void {
        this.config = { ...this.config, ...config };
        this.logger.log('WhiteScreenPlugin: Config updated', this.config);
    }

    /**
     * 获取当前配置
     */
    getConfig(): WhiteScreenConfig {
        return { ...this.config };
    }
}