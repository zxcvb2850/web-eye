import {Plugin} from "../core/Plugin";
import {MonitorType, RequestData} from "../types";
import {replaceOriginal} from "../utils/helpers";
import {safeJsonParse} from "../utils/common";

/**
 * 请求监控插件
 * */
export class RequestPlugin extends Plugin {
    name = 'RequestPlugin';
    private originalFetch!: typeof fetch;
    private originalXHROpen!: typeof XMLHttpRequest.prototype.open;
    private originalXHRSend!: typeof XMLHttpRequest.prototype.send;

    protected init(): void {
        console.info("Init RequestPlugin");

        this.originalFetch = window.fetch;
        this.originalXHROpen = XMLHttpRequest.prototype.open;
        this.originalXHRSend = XMLHttpRequest.prototype.send;

        this.interceptFetch();
        this.interceptXHR();
    }

    protected destroy(): void {
        // 还原 fetch 和 XHR 原生方法
        window.fetch = this.originalFetch;
        XMLHttpRequest.prototype.open = this.originalXHROpen;
        XMLHttpRequest.prototype.send = this.originalXHRSend;
    }

    /**
     * 拦截 Fetch API
     * */
    private interceptFetch(): void {
        const _this = this;

        replaceOriginal(window, 'fetch', (originalFetch) => {
            return async function(input: RequestInfo, init?: RequestInit): Promise<Response> {
                const startTime = Date.now();
                const url = typeof input === 'string' ? input : input.url;
                const method = (init?.method || "GET").toUpperCase();

                // 监控请求白名单
                if (!_this.shouldMonitorRequest(url, init?.headers)){
                    return originalFetch(input, init);
                }

                let response: Response;
                let success = true;
                let errorMessage: string | undefined;
                let isCorsError = false; // 是否是跨域错误

                try {
                    response  = await originalFetch(input, init);
                    success = response.ok;

                    if (!success) {
                        errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
                    }
                } catch (error) {
                    success = false;
                    isCorsError = _this.isFetchCorsError(error, url);
                    errorMessage = error instanceof Error ? error.message : `Fetch Error`;
                    throw error;
                } finally {
                    const endTime = Date.now();
                    const duration = endTime - startTime;

                    _this.safeExecute(() => {
                        const requestData: Partial<RequestData> = {
                            type: MonitorType.REQUEST,
                            data: {
                                url, method, duration, success, errorMessage, isCorsError,
                                status: response?.status || 0,
                                requestHeaders: _this.getRequestHeaders(init?.headers),
                                responseHeaders: response ? _this.getResponseHeaders(response.headers) : undefined,
                                requestParams: _this.getRequestParams(input, init),
                            }
                        };
                        _this.report(requestData);

                        console.info("requestData =====>", requestData);
                    })
                }

                return response;
            }
        })
    }

    /**
     * 拦截 XMLHttpRequest
     * */
    private interceptXHR(): void {
        const _this = this;

        // 拦截 Open 方法
        replaceOriginal(XMLHttpRequest.prototype, 'open', (originalOpen) => {
            return function(this: XMLHttpRequest, method: string, url: string, async?: boolean, user?: string, password?: string) {
                // 储存请求信息到实例上
                (this as any)._web_eye_data_ = {
                    method: method.toUpperCase(),
                    url,
                    startTime: Date.now(),
                    requestHeaders: {},
                    requestParams: null,
                }

                return originalOpen.call(this, method, url, async, user, password);
            }
        })

        // 拦截 Headers 方法
        replaceOriginal(XMLHttpRequest.prototype, 'setRequestHeader', (originalSetRequestHeader) => {
            return function(this: XMLHttpRequest, header: string, value: string) {
                const _webEyeData_ = (this as any)._web_eye_data_;
                _webEyeData_.requestHeaders[header] = value;
                return originalSetRequestHeader.call(this, header, value);
            }
        })

        // 拦截 Send 方法
        replaceOriginal(XMLHttpRequest.prototype, 'send', (originalSend) => {
            return function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
                const _webEyeData_ = (this as any)._web_eye_data_;

                if (!_webEyeData_ || !_this.shouldMonitorRequest(_webEyeData_.url, _webEyeData_?.requestHeaders)) {
                    return originalSend.call(this, body);
                }

                _webEyeData_.requestParams = _this.getXHRRequestParams(_webEyeData_.url, body);

                // 监听状态变化
                const originalOnReadyStateChange = this.onreadystatechange;

                this.onreadystatechange = function(this: XMLHttpRequest, ev: Event) {
                    if (this.readyState === XMLHttpRequest.DONE) {
                        const endTime = Date.now();
                        const duration = endTime - _webEyeData_.startTime;
                        const success  = this.status >= 200 && this.status < 400;
                        const isCorsError = _this.isXHRCorsError(this);

                        let errorMessage: string | undefined;
                        if (!success) {
                            if (this.status === 0 && isCorsError) {
                                errorMessage = `CORS Error`;
                            } else if (this.status === 0) {
                                errorMessage = `Network Error`;
                            } else {
                                errorMessage = `HTTP Error: ${this.status} ${this.statusText}`;
                            }
                        }

                        _this.safeExecute(() => {
                            const requestData: Partial<RequestData> = {
                                type: MonitorType.REQUEST,
                                data: {
                                    url: _webEyeData_.url,
                                    method: _webEyeData_.method,
                                    duration, success, errorMessage, isCorsError,
                                    status: this.status,
                                    requestHeaders: _webEyeData_.requestHeaders,
                                    responseHeaders: _this.getXHRResponseHeaders(this),
                                    requestParams: _webEyeData_.requestParams,
                                }
                            }
                            _this.report(requestData);

                            console.info("XHR requestData =====>", requestData);
                        })
                    }

                    // 调用原始的 onreadystatechange
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.call(this, ev);
                    }
                }

                return originalSend.call(this, body);
            }
        })
    }

    /**
     * 获取 Fetch 请求头
     * */
    private getRequestHeaders(headers?: HeadersInit): Record<string, string> | undefined {
        if (!headers) return undefined;

        const result: Record<string, string> = {};

        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                result[key] = value;
            });
        } else if (Array.isArray(headers)) {
            headers.forEach(([key, value]) => {
                result[key] = value;
            })
        } else {
            Object.entries(headers).forEach(([key, value]) => {
                result[key] = value;
            })
        }

        return Object.keys(result).length > 0 ? result : undefined;
    }

    /**
     * 获取 Fetch 响应头
     * */
    private getResponseHeaders(headers: Headers): Record<string, string> | undefined {
        const result: Record<string, string> = {};

        headers.forEach((value, key) => {
            result[key] = value;
        })

        return Object.keys(result).length > 0 ? result : undefined;
    }

    /**
     * 获取 Fetch 请求参数
     * */
    private getRequestParams(input: RequestInfo, init?: RequestInit): any {
        try {
            const url = typeof input === "string" ? input : input.url;
            const method = (init?.method || "GET").toUpperCase();

            const params: any = {};
            const query = this.parseQueryParams(url);
            if (query) params.query = query;

            // 获取请求体参数
            if (init?.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                if (typeof init.body === 'string') {
                    // 尝试解析 JSON
                    const json = safeJsonParse(init.body, null);
                    if (json) {
                        params.body = json;
                    } else {
                        // 尝试解析 URL 编码
                        if (init.body.includes('=')) {
                            const formData = Object.fromEntries(new URLSearchParams(init.body));
                            params.body = formData;
                        } else {
                            params.body = init.body;
                        }
                    }
                } else if (init.body instanceof FormData) {
                    const formDataObj: Record<string, any> = {};
                    init.body.forEach((value, key) => {
                        formDataObj[key] = value;
                    });
                    params.body = formDataObj;
                } else if (init.body instanceof URLSearchParams) {
                    params.body = Object.fromEntries(init.body);
                } else {
                    params.body = '[Binary Data]';
                }
            }

            return Object.keys(params).length > 0 ? params : undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * 判断 Fetch 是否是跨域错误
     * */
    private isFetchCorsError(error: any, url: string): boolean {
        try {
            // 检查错误消息中是否包含 CORS 相关关键词
            const errorMessage = error?.message?.toLowerCase() || '';
            const corsKeywords = [
                'cors',
                'cors-origin',
                'access-control-allow-origin',
                'blocked by cors policy',
                'mode cors'
            ];

            const hasCorsKeyword = corsKeywords.some(keyword => errorMessage.includes(keyword));

            // 检查是否是不同域的请求
            const isDifferentOrigin = this.isDifferentOrigin(url);

            // 网络类型错误且是跨域请求，很有可能是 CORS 错误
            const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch');

            return hasCorsKeyword || (isDifferentOrigin && isNetworkError);
        } catch {
            return false;
        }
    }

    /**
     * 获取 Fetch 响应头
     * */
    private getXHRResponseHeaders(xhr: XMLHttpRequest): Record<string, string> | undefined {
        try {
            const headerString = xhr.getAllResponseHeaders();
            if (!headerString) return undefined;

            const result: Record<string, string> = {};
            const headers = headerString.trim().split('\r\n');

            headers.forEach(header => {
                const [key, ...valueParts] = header.split(': ');
                if (key && valueParts.length > 0) {
                    result[key.toLowerCase()] = valueParts.join(': ');
                }
            });

            return Object.keys(result).length > 0 ? result : undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * 获取 XHR 请求参数
     * */
    private getXHRRequestParams(url: string, body?: Document | XMLHttpRequestBodyInit | null): any {
        try {
            const params: any = {};
            const query = this.parseQueryParams(url);
            if (query) params.query = query;

            if (!body) return params;

            if (typeof body === "string") {
                const json = safeJsonParse(body, null);
                if (json) {
                    params.body = json;
                } else {
                    if (body.includes("=")) {
                        params.body = Object.fromEntries(new URLSearchParams(body));
                    } else {
                        params.body = body;
                    }
                }
            } else if (body instanceof FormData) {
                const formDataObj: Record<string, any> = {};
                body.forEach((value, key) => {
                    formDataObj[key] = value;
                })
                params.body = formDataObj;
            } else if (body instanceof URLSearchParams) {
                params.body = Object.fromEntries(body);
            } else if (body instanceof ArrayBuffer || body instanceof Blob) {
                params.body = `[Binary Data]`;
            } else {
                params.body = `[Unknown Data Type]`;
            }
            return params;
        } catch (error) {
            console.error("XHR Get Params ====>", error);
            return undefined;
        }
    }

    /**
     * 判断 XHR 是否是跨域错误
     * */
    private isXHRCorsError(xhr: XMLHttpRequest): boolean {
        try {
            // XHR 跨域错误的特征： status 为 0，且没有响应头
            if (xhr.status === 0) {
                const responseHeaders = xhr.getAllResponseHeaders();
                const isDifferentOrigin = this.isDifferentOrigin((xhr as  any)._web_eye_data_?.url || '');

                // status 为 0, 没有响应头，且是跨域请求，很有可能是 CORS 错误
                return !responseHeaders && isDifferentOrigin;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * 检查是否是不同源的请求
     * */
    private isDifferentOrigin(url: string): boolean {
        try {
            const requestUrl = new URL(url, window.location.origin);
            const currentOrigin = window.location.origin;
            return requestUrl.origin !== currentOrigin;
        } catch {
            return false;
        }
    }

    /**
     * 检查是否应该监控此请求
     * */
    private shouldMonitorRequest(url: string, headers: HeadersInit | string | undefined): boolean {
        if (headers?.['EyeLogTag']) return false;

        // 过滤掉上报接口的请求，避免无限循环
        return !url.includes(this.monitor.getConfig().reportUrl);
    }

    /**
     * 获取 URL 查询参数
     * */
    private parseQueryParams(url: string): Record<string, string | string[]> {
        const u = new URL(url, location.origin)
        const result: Record<string, string | string[]> = {}

        u.searchParams.forEach((value, key) => {
            if (result[key]) {
                result[key] = Array.isArray(result[key])
                    ? [...(result[key] as string[]), value]
                    : [result[key] as string, value]
            } else {
                result[key] = value
            }
        })

        return result
    }
}














































