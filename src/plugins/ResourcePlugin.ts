import {Plugin} from "../core/Plugin";
import {MonitorType} from "../types";

/**
 * 资源错误错误类型枚举
 * */
export enum ResourceErrorType {
    NETWORK = 'network', // 网络错误
    NOT_FOUND = 'not_found', // 资源不存在(404)
    CORS = 'cors', // 跨域错误
    TIMEOUT = 'timeout', // 超时错误
    SERVER = 'server', // 服务器错误
    UNKNOWN = 'unknown', // 未知错误
}

/**
 * 资源类型枚举
 * */
export enum ResourceType {
    SCRIPT = 'script', // JavaScript 脚本
    CSS = 'css', // CSS 样式
    OTHER = 'other', // 其他资源
    UNKNOWN = 'unknown', // 未知资源
}

interface ResourceErrorData {
    path : string;
    resourceType: ResourceType;
    errorType: ResourceErrorType;
    tagName: string;
    outerHTML: string; // 限制长度
    timestamp: number;
    isFromCache: boolean
    transferSize?: number;
    errorMessage?: string;
    decodedBodySize?: number;
    loadTime: number;
}

/**
 * 资源错误插件
 * */
export class ResourcePlugin extends Plugin {
    name = "ResourcePlugin";
    private errorHandler?: EventListener;
    private performanceObserver?: PerformanceObserver;

    protected init(): void {
        console.info("Init ResourcePlugin");

        this.interceptResourceErrors();
        this.monitorResourcePerformance();
    }

    protected destroy() : void {
        // 移除错误监听
        if (this.errorHandler) {
            window.removeEventListener('error', this.errorHandler, true);
            window.removeEventListener('unhandledrejection', this.errorHandler);
        }

        // 断开性能观察器
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
    }

    /**
     * 拦截资源错误
     * */
    private interceptResourceErrors(): void {
        const _this = this;

        // 监听资源加载错误（捕获阶段）
        this.errorHandler = (event: Event) => {
            // JavaScript 运行时错误，不是资源加载错误
            if (event instanceof ErrorEvent) return;

            const target = event.target as HTMLElement;
            // @ts-ignore
            if (!target || target === window) return;

            _this.safeExecute(() => {
                const resourceError = _this.parseResourceError(target, event);
                if (resourceError && _this.shouldMonitorResource(resourceError.path)) {
                    _this.report({
                        type: MonitorType.RESOURCE,
                        data: resourceError
                    })

                    console.info("Resource Error ===> ", {
                        type: MonitorType.RESOURCE,
                        data: resourceError
                    });
                }
            })
        }

        // 使用捕获监听，确保能捕获到所有资源错误
        window.addEventListener('error', this.errorHandler, true);

        // 监听 Promise 拒绝（可能包含资源相关的异步错误）
        window.addEventListener('unhandledrejection', (event) => {
            _this.safeExecute(() => {
                const error = event.reason;

                // 检查是否是资源相关的 Promise 错误
                if (_this.isResourceRelatedPromiseError(error)) {
                    const resourceError = _this.parsePromiseResourceError(error);
                    if (resourceError && _this.shouldMonitorResource(resourceError.path)) {
                        _this.report({
                            type: MonitorType.RESOURCE,
                            data: resourceError
                        })

                        console.info("Promise Resource Error =====>", resourceError);
                    }
                }
            })
        });
    }

    /**
     * 监控资源性能（用于检测超时等问题）
     * */
    private monitorResourcePerformance(): void {
        if (!window.PerformanceObserver) return;

        const _this = this;

        try {
            this.performanceObserver = new PerformanceObserver((list) => {
                _this.safeExecute(() => {
                    const entries = list.getEntries();

                    entries.forEach((entry) => {
                        if (entry.entryType === 'resource') {
                            const resourceEntry = entry as PerformanceResourceTiming;

                            // 检查是否有异常的资源加载时间
                            const isTimeout = _this.isResourceTimeout(resourceEntry);
                            const isSlowLoading = _this.isSlowLoading(resourceEntry);

                            if (isTimeout || isSlowLoading) {
                                const resourceError = _this.parsePerformanceResourceError(resourceEntry, isTimeout);
                                if (resourceError && _this.shouldMonitorResource(resourceError.path)) {
                                    _this.report({
                                        type: MonitorType.RESOURCE,
                                        data: resourceError
                                    });

                                    console.info("Performance Resource Error =====>", resourceError);
                                }
                            }
                        }
                    });
                });
            });

            this.performanceObserver.observe({ entryTypes: ['resource'] });
        } catch (error) {
            console.warn('Failed to create PerformanceObserver:', error);
        }
    }

    /**
     * 解析资源错误信息
     */
    private parseResourceError(target: HTMLElement, event: Event): ResourceErrorData | null {
        try {
            const tagName = target.tagName?.toLowerCase();
            const url = this.getResourceUrl(target);

            if (!url) {
                return null;
            }

            const resourceType = this.getResourceType(target, url);
            const errorType = this.determineErrorType(target, url);

            return {
                path: url,
                resourceType,
                errorType,
                tagName,
                outerHTML: target.outerHTML?.substring(0, 100), // 限制长度
                timestamp: Date.now(),
                isFromCache: false,
                loadTime: 0 // 无法准确获取加载时间
            };
        } catch (error) {
            console.warn('Failed to parse resource error:', error);
            return null;
        }
    }

    /**
     * 解析 Promise 相关的资源错误
     */
    private parsePromiseResourceError(error: any): ResourceErrorData | null {
        try {
            // 尝试从错误信息中提取资源 URL
            const errorMessage = error?.message || error?.toString() || '';
            const urlMatch = errorMessage.match(/https?:\/\/[^\s]+/);

            if (!urlMatch) {
                return null;
            }

            const url = urlMatch[0];
            const resourceType = this.getResourceTypeFromUrl(url);
            const errorType = ResourceErrorType.NETWORK; // Promise 错误通常是网络相关

            return {
                path: url,
                resourceType,
                errorType,
                tagName: 'unknown',
                outerHTML: '',
                timestamp: Date.now(),
                isFromCache: false,
                loadTime: 0,
                errorMessage: errorMessage.substring(0, 200)
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * 解析性能监控中的资源错误
     */
    private parsePerformanceResourceError(entry: PerformanceResourceTiming, isTimeout: boolean): ResourceErrorData | null {
        try {
            const url = entry.name;
            const resourceType = this.getResourceTypeFromUrl(url);
            const errorType = isTimeout ? ResourceErrorType.TIMEOUT : ResourceErrorType.NETWORK;

            return {
                path: url,
                resourceType,
                errorType,
                tagName: 'performance',
                outerHTML: '',
                timestamp: Date.now(),
                isFromCache: entry.transferSize === 0 && entry.decodedBodySize > 0,
                loadTime: entry.duration,
                transferSize: entry.transferSize,
                decodedBodySize: entry.decodedBodySize
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取资源 URL
     */
    private getResourceUrl(element: HTMLElement): string | null {
        const tagName = element.tagName?.toLowerCase();

        switch (tagName) {
            case 'img':
                return (element as HTMLImageElement).src;
            case 'script':
                return (element as HTMLScriptElement).src;
            case 'link':
                return (element as HTMLLinkElement).href;
            case 'iframe':
                return (element as HTMLIFrameElement).src;
            case 'audio':
                return (element as HTMLAudioElement).src;
            case 'video':
                return (element as HTMLVideoElement).src;
            case 'source':
                return (element as HTMLSourceElement).src;
            case 'object':
                return (element as HTMLObjectElement).data;
            case 'embed':
                return (element as HTMLEmbedElement).src;
            default:
                // 尝试从通用属性获取
                return element.getAttribute('src') ||
                    element.getAttribute('href') ||
                    element.getAttribute('data') || null;
        }
    }

    /**
     * 获取资源类型
     */
    private getResourceType(element: HTMLElement, url: string): ResourceType {
        const tagName = element.tagName?.toLowerCase();

        // 首先根据 HTML 标签判断
        switch (tagName) {
            case 'script':
                return ResourceType.SCRIPT;
            case 'link':
                const rel = (element as HTMLLinkElement).rel?.toLowerCase();
                if (rel === 'stylesheet') {
                    return ResourceType.CSS;
                } else if (rel === 'preload' || rel === 'prefetch') {
                    // 根据 as 属性判断
                    const as = (element as HTMLLinkElement).as?.toLowerCase();
                    return this.getResourceTypeFromAs(as) || this.getResourceTypeFromUrl(url);
                }
                return ResourceType.OTHER;
            default:
                return this.getResourceTypeFromUrl(url);
        }
    }

    /**
     * 根据 URL 推断资源类型
     */
    private getResourceTypeFromUrl(url: string): ResourceType {
        try {
            const urlObj = new URL(url, window.location.origin);
            const pathname = urlObj.pathname.toLowerCase();
            const ext = pathname.split('.').pop() || '';

            // JavaScript 文件
            if (['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(ext)) {
                return ResourceType.SCRIPT;
            }

            // CSS 文件
            if (['css', 'scss', 'sass', 'less'].includes(ext)) {
                return ResourceType.CSS;
            }

            return ResourceType.OTHER;
        } catch (error) {
            return ResourceType.UNKNOWN;
        }
    }

    /**
     * 根据 as 属性获取资源类型
     */
    private getResourceTypeFromAs(as?: string): ResourceType | null {
        if (!as) return null;

        switch (as.toLowerCase()) {
            case 'script':
                return ResourceType.SCRIPT;
            case 'style':
                return ResourceType.CSS;
            default:
                return ResourceType.OTHER;
        }
    }

    /**
     * 确定错误类型
     */
    private determineErrorType(element: HTMLElement, url: string): ResourceErrorType {
        try {
            // 检查是否是跨域问题
            if (this.isDifferentOrigin(url)) {
                // 跨域资源，很可能是 CORS 问题
                return ResourceErrorType.CORS;
            }

            // 对于同域资源，可能是网络问题或资源不存在
            // 这里无法准确判断具体错误类型，返回网络错误
            return ResourceErrorType.NETWORK;
        } catch (error) {
            return ResourceErrorType.UNKNOWN;
        }
    }

    /**
     * 检查是否是不同源的请求
     */
    private isDifferentOrigin(url: string): boolean {
        try {
            const resourceUrl = new URL(url, window.location.origin);
            const currentOrigin = window.location.origin;
            return resourceUrl.origin !== currentOrigin;
        } catch {
            return false;
        }
    }

    /**
     * 检查是否是资源相关的 Promise 错误
     */
    private isResourceRelatedPromiseError(error: any): boolean {
        if (!error) return false;

        const errorString = error.toString().toLowerCase();
        const resourceKeywords = [
            'failed to fetch',
            'network error',
            'load failed',
            'cors',
            'cross-origin',
            'blocked',
            'net::',
            'loading css',
            'loading script',
            'loading image'
        ];

        return resourceKeywords.some(keyword => errorString.includes(keyword));
    }

    /**
     * 检查资源是否超时
     */
    private isResourceTimeout(entry: PerformanceResourceTiming): boolean {
        // 如果资源加载时间超过 30 秒，认为是超时
        const timeoutThreshold = 30000;
        return entry.duration > timeoutThreshold;
    }

    /**
     * 检查资源是否加载缓慢
     */
    private isSlowLoading(entry: PerformanceResourceTiming): boolean {
        // 如果资源加载时间超过 10 秒，认为是慢加载
        const slowThreshold = 10000;
        return entry.duration > slowThreshold && entry.duration <= 30000;
    }

    /**
     * 检查是否应该监控此资源
     * */
    private shouldMonitorResource(url: string): boolean {
        try {
            // 过滤掉上报接口的请求
            const reportUrl = this.monitor.getConfig().reportUrl;
            if (reportUrl && url.includes(reportUrl)) return false;

            // 过滤掉一些系统资源
            const excludePatterns = [
                'chrome-extension://',
                'moz-extension://',
                'safari-extension://',
                'data:',
                'blob:',
                'about:',
                'javascript:',
                // 过滤掉一些常见的广告和统计资源
                'googletagmanager.com',
                'google-analytics.com',
                'googlesyndication.com',
                'facebook.com/tr',
                'twitter.com/i/adsct'
            ];
            return !excludePatterns.some(pattern => url.includes(pattern));
        } catch (error) {
            console.error(`ResourceErrorPlugin ShouldMonitorResource Error: `, error);
            return true;
        }
    }
}