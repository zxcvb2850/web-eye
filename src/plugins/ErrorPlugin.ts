import { Plugin } from "../core/Plugin";
import { LoggerPlugin } from "./LoggerPlugin";
import {generateId, sleep, throttle} from "../utils/common";
import {MonitorType} from "../types";

/**
 * 错误类型枚举
 */
export enum ErrorType {
    JS_ERROR = 'js_error',
    REACT_ERROR = 'react_error',
    VUE_ERROR = 'vue_error',
    UNHANDLED_REJECTION = 'unhandled_rejection'
}

interface StackInfo {
    stack: string;
    filename: string;
    lineno: number;
    colno: number;
}

/**
 * 错误信息接口
 */
interface ErrorInfo {
    id: string;
    type: ErrorType;
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    originalStack?: string | StackInfo[]; // source map 解析后的堆栈
    componentStack?: string; // React/Vue 组件堆栈
    props?: any; // React 错误边界中的 props
    errorInfo?: any; // 额外错误信息
    timestamp: number;
}

/**
 * 用户行为记录接口
 */
interface UserAction {
    type: string;
    target?: string;
    timestamp: number;
    data?: any;
}

/**
 * ErrorPlugin配置接口
 */
interface ErrorConfig {
    enableBehaviorReport: boolean; // 是否启用行为上报
    behaviorDelay: number; // 错误发生后延迟上报时间(ms)
    maxBehaviorRecords: number; // 最大行为记录数
    enableSourceMap: boolean; // 是否启用source map解析
    filterErrors: (error: ErrorInfo) => boolean; // 错误过滤函数
}

/**
 * JS错误监控插件
 */
export class ErrorPlugin extends Plugin {
    name = 'ErrorPlugin';

    private config: ErrorConfig = {
        enableBehaviorReport: true,
        behaviorDelay: 5000, // 5秒延迟
        maxBehaviorRecords: 50,
        enableSourceMap: true,
        filterErrors: () => true
    };

    private behaviorQueue: UserAction[] = [];
    private pendingErrors: Map<string, { error: ErrorInfo; timer: NodeJS.Timeout }> = new Map();
    private logger: any;

    constructor(config?: Partial<ErrorConfig>) {
        super();
        this.config = { ...this.config, ...config };
    }

    protected init(): void {
        // 获取Logger实例
        const loggerPlugin = this.monitor.getPlugin('LoggerPlugin') as LoggerPlugin;
        this.logger = loggerPlugin?.getLogger() || console;

        this.logger.log('Init ErrorPlugin');

        // 绑定错误监听
        this.bindErrorListeners();

        // 如果启用行为监控，开始记录用户行为
        if (this.config.enableBehaviorReport) {
            this.startBehaviorTracking();
        }

        // 绑定页面卸载事件
        this.bindBeforeUnload();
    }

    protected destroy(): void {
        this.logger.log('Destroy ErrorPlugin');

        // 移除错误监听
        this.removeErrorListeners();

        // 停止行为追踪
        this.stopBehaviorTracking();

        // 清除所有pending的错误定时器
        this.pendingErrors.forEach(({ timer }) => clearTimeout(timer));
        this.pendingErrors.clear();
    }

    /**
     * 绑定全局错误监听器
     */
    private bindErrorListeners(): void {
        // JS运行时错误
        // @ts-ignore
        this.addEventListener(window, 'error', this.handleJSError.bind(this));

        // Promise未捕获错误（如果需要的话可以启用）
        // this.addEventListener(window, 'unhandledrejection', this.handlePromiseError.bind(this));
    }

    /**
     * 移除错误监听器
     */
    private removeErrorListeners(): void {
        // @ts-ignore
        this.removeEventListener(window, 'error', this.handleJSError.bind(this));
        // this.removeEventListener(window, 'unhandledrejection', this.handlePromiseError.bind(this));
    }

    /**
     * 处理JS错误
     */
    private handleJSError(event: ErrorEvent): void {
        this.safeExecute(() => {
            const errorInfo: ErrorInfo = {
                id: generateId(),
                type: ErrorType.JS_ERROR,
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now(),
            };

            this.processError(errorInfo);
        });
    }

    /**
     * 处理Promise错误（如果需要）
     */
    private handlePromiseError(event: PromiseRejectionEvent): void {
        this.safeExecute(() => {
            const errorInfo: ErrorInfo = {
                id: generateId(),
                type: ErrorType.UNHANDLED_REJECTION,
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                timestamp: Date.now(),
            };

            this.processError(errorInfo);
        });
    }

    /**
     * 处理错误信息
     */
    private async processError(errorInfo: ErrorInfo): Promise<void> {
        // 错误过滤
        if (!this.config.filterErrors(errorInfo)) {
            return;
        }

        this.logger.error('Captured error:', errorInfo.message);

        // 如果启用source map，尝试解析原始位置
        if (this.config.enableSourceMap && errorInfo.stack) {
            const originalStack = await this.parseSourceMap(errorInfo.stack);
            errorInfo.originalStack = originalStack;
            if (Array.isArray(originalStack) && originalStack?.length) {
                const firstStack = originalStack[0];
                errorInfo.lineno = firstStack.lineno;
                errorInfo.colno = firstStack.colno;
                errorInfo.filename = firstStack.filename;
            }
        }

        // 如果不需要行为上报，直接上报错误
        if (!this.config.enableBehaviorReport) {
            await this.reportError(errorInfo);
            return;
        }

        // 需要行为上报，延迟上报
        let timer = setTimeout(async () => {
            await this.reportError(errorInfo);
            this.pendingErrors.delete(errorInfo.id);
        }, this.config.behaviorDelay);

        this.pendingErrors.set(errorInfo.id, { error: errorInfo, timer });
    }

    /**
     * 处理React错误（由用户调用此API）
     */
    private handleReactError(error: Error, errorInfo: any, props?: any): void {
        this.safeExecute(() => {
            const errorInfoObj: ErrorInfo = {
                id: generateId(),
                type: ErrorType.REACT_ERROR,
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                props: this.serializeProps(props),
                errorInfo,
                timestamp: Date.now(),
            };

            this.processError(errorInfoObj);
        });
    }

    /**
     * 处理Vue错误（由用户调用此API）
     */
    private handleVueError(error: Error, vm: any, info: string): void {
        this.safeExecute(() => {
            const errorInfo: ErrorInfo = {
                id: generateId(),
                type: ErrorType.VUE_ERROR,
                message: error.message,
                stack: error.stack,
                componentStack: this.getVueComponentStack(vm),
                errorInfo: {
                    info,
                    componentName: vm?.$options?.name || vm?.$options?._componentTag,
                    propsData: vm?.$options?.propsData
                },
                timestamp: Date.now(),
            };

            this.processError(errorInfo);
        });
    }

    /**
     * 获取Vue组件堆栈
     */
    private getVueComponentStack(vm: any): string {
        if (!vm) return '';

        const stack = [];
        let current = vm;

        while (current) {
            if (current.$options) {
                const name = current.$options.name || current.$options._componentTag || 'Anonymous';
                stack.push(name);
            }
            current = current.$parent;
        }

        return stack.join(' -> ');
    }

    /**
     * 序列化React props
     */
    private serializeProps(props: any): any {
        if (!props) return null;

        try {
            return JSON.parse(JSON.stringify(props, (key, value) => {
                if (typeof value === 'function') {
                    return `[Function: ${value.name || 'anonymous'}]`;
                }
                if (value instanceof Error) {
                    return {
                        name: value.name,
                        message: value.message,
                        stack: value.stack
                    };
                }
                return value;
            }));
        } catch (error) {
            return '[Serialization Error]';
        }
    }

    /**
     * 解析source map
     */
    private async parseSourceMap(stack: string): Promise<string | StackInfo[]> {
        if (!this.config.enableSourceMap) return stack;

        try {
            // 不解析source map，放置后端解析
            const lines = stack.split('\n');
            const mappedLines = [];
            const len = lines.length;
            for (let i = 0; i < len; i++) {
                const line = lines[i];
                const match = line.match(/at.*\((.*):(\d+):(\d+)\)/);
                if (match) {
                    const [stackErr, filename, lineno, colno] = match;
                    mappedLines.push({
                        stack: stackErr,
                        filename,
                        lineno: Number(lineno),
                        colno: Number(colno),
                    })

                    if (mappedLines.length >= 5) break;
                }
            }

            // 这里实现source map解析逻辑
            // 由于source map解析比较复杂，这里提供基本框架
            /*const mappedLines = await Promise.all(
                lines.map(async (line, index) => {
                    const match = line.match(/at.*\((.*):(\d+):(\d+)\)/);
                    if (match && index < 5) {
                        const [, filename, lineno, colno] = match;
                        try {
                            const mappedLocation = await this.fetchSourceMapLocation(
                                filename,
                                parseInt(lineno),
                                parseInt(colno)
                            );
                            if (mappedLocation) {
                                return line.replace(
                                    `${filename}:${lineno}:${colno}`,
                                    `${mappedLocation.source}:${mappedLocation.line}:${mappedLocation.column}`
                                );
                            }
                        } catch (error) {
                            // source map解析失败，返回原始行
                        }
                    }
                    return line;
                })
            );*/
            return mappedLines;
        } catch (error) {
            this.logger.warn('Source map parsing failed:', error);
            return stack;
        }
    }

    /**
     * 获取source map位置信息
     */
    private async fetchSourceMapLocation(
        filename: string,
        line: number,
        column: number
    ): Promise<{ source: string; line: number; column: number } | null> {
        /*try {
            // 尝试获取source map文件
            const mapUrl = `${filename}.map`;
            let retryCount = 0;

            while (retryCount < this.config.sourceMapRetryCount) {
                try {
                    const headers = { "EyeLogTag": '1'}; // 用于标记是SDK内部发送的请求
                    const response = await fetch(mapUrl, { headers });
                    if (response.ok) {
                        const sourceMap = await response.json();
                        // 这里需要使用source-map库来解析，简化示例
                        // 实际项目中需要安装并使用source-map库
                        return this.parseSourceMapContent(sourceMap, line, column);
                    } else {
                        throw response;
                    }
                } catch (error) {
                    retryCount++;
                    if (retryCount >= this.config.sourceMapRetryCount) {
                        break;
                    }
                    await sleep(2000 * retryCount); // 重试延迟
                }
            }
        } catch (error) {
            // 忽略source map获取错误
        }*/

        return null;
    }

    /**
     * 解析source map内容（简化版本）
     */
    private parseSourceMapContent(
        sourceMap: any,
        line: number,
        column: number
    ): { source: string; line: number; column: number } | null {
        // 这里应该使用专业的source-map库来解析
        // 由于库较大，这里提供简化的示例框架
        try {
            // 实际解析逻辑需要source-map库
            return {
                source: sourceMap.sources?.[0] || 'unknown',
                line: line,
                column: column
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 开始用户行为追踪
     */
    private startBehaviorTracking(): void {
        // 记录点击事件
        this.addEventListener(document, 'click', (event) => {
            this.recordUserAction({
                type: 'click',
                target: this.getElementSelector(event.target as Element),
                timestamp: Date.now(),
                data: {
                    tagName: (event.target as Element)?.tagName,
                    className: (event.target as Element)?.className,
                    innerText: (event.target as Element)?.textContent?.slice(0, 50)
                }
            });
        });

        // 记录输入事件
        /*this.addEventListener(document, 'input', (event) => {
            this.recordUserAction({
                type: 'input',
                target: this.getElementSelector(event.target as Element),
                timestamp: Date.now(),
                data: {
                    tagName: (event.target as Element)?.tagName,
                    type: (event.target as HTMLInputElement)?.type,
                    name: (event.target as HTMLInputElement)?.name
                }
            });
        });*/

        // 记录滚动事件（节流）
        this.addEventListener(window, 'scroll', throttle(() => {
            this.recordUserAction({
                type: 'scroll',
                timestamp: Date.now(),
                data: {
                    scrollY: window.scrollY,
                    scrollX: window.scrollX
                }
            });
        }, 5000));

        // 记录页面跳转
        this.addEventListener(window, 'hashchange', () => {
            this.recordUserAction({
                type: 'hashchange',
                timestamp: Date.now(),
                data: {
                    hash: window.location.hash,
                    href: window.location.href
                }
            });
        });
    }

    /**
     * 停止用户行为追踪
     */
    private stopBehaviorTracking(): void {
        // 移除事件监听器在destroy方法中已处理
    }

    /**
     * 记录用户行为
     */
    private recordUserAction(action: UserAction): void {
        this.behaviorQueue.push(action);

        // 限制队列长度
        if (this.behaviorQueue.length > this.config.maxBehaviorRecords) {
            this.behaviorQueue.shift();
        }
    }

    /**
     * 获取元素选择器
     */
    private getElementSelector(element: Element): string {
        if (!element) return '';

        if (element.id) {
            return `#${element.id}`;
        }

        if (element.className) {
            return `.${element.className.split(' ')[0]}`;
        }

        return element.tagName.toLowerCase();
    }

    /**
     * 上报错误及用户行为
     */
    private async reportError(errorInfo: ErrorInfo): Promise<void> {
        const behaviorData = [...this.behaviorQueue];

        const data: Record<string, any> = { error: errorInfo };
        if (behaviorData?.length) {
            data.behaviors = behaviorData;
        }

        this.logger.log("Report Error Plugin ====> ", {
            type: MonitorType.CODE,
            data
        });

        await this.report({
            type: MonitorType.CODE,
            data
        });
    }

    /**
     * 绑定页面卸载事件
     */
    private bindBeforeUnload(): void {
        this.addEventListener(window, 'beforeunload', () => {
            this.handleBeforeUnload();
        });

        this.addEventListener(document, 'visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.handleBeforeUnload();
            }
        });
    }

    /**
     * 处理页面卸载
     */
    private handleBeforeUnload(): void {
        // 立即上报所有pending的错误
        this.pendingErrors.forEach(async ({ error, timer }) => {
            timer && clearTimeout(timer);
            await this.reportError(error);
        });
        this.pendingErrors.clear();
    }

    /**
     * 手动上报错误
     */
    async reportPendingErrors(): Promise<void> {
        const promises = Array.from(this.pendingErrors.values()).map(async ({ error, timer }) => {
            clearTimeout(timer);
            await this.reportError(error);
        });

        this.pendingErrors.clear();
        await Promise.all(promises);
    }

    /**
     * 设置错误过滤器
     */
    setErrorFilter(filter: (error: ErrorInfo) => boolean): void {
        this.config.filterErrors = filter;
    }

    /**
     * 获取当前行为队列
     */
    getBehaviorQueue(): UserAction[] {
        return [...this.behaviorQueue];
    }

    /**
     * 清空行为队列
     */
    clearBehaviorQueue(): void {
        this.behaviorQueue = [];
    }
}