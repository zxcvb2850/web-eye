import {
    _global, _support,
    formatHeadersKey,
    getDomainUrl,
    getQueryParams,
    getTimestamp, on, parseStackError,
    parseUrlEncodedBody,
    replaceOriginal,
    filterWhiteList,
    isFunction,
    stringToJSON,
} from '../utils';
import {IAnyObject, NetworkErrorEnum, ReportTypeEnum} from "../types";
import logger from '../logger';
import reportLogs from '../report';

// fetch 请求类型
enum FetchResponseType {
    'video/x-matroska' = 'video/x-matroska',
    'blapplication/octet-streamob' = 'application/octet-stream',
    'document' = 'document',
    'application/json' = 'application/json',
    'text/plain' = 'text/plain',
}

// XHR 请求类型
enum XMLHttpRequestResponseType {
    'arraybuffer' = 'arraybuffer',
    'blob' = 'blob',
    'document' = 'document',
    'json' = 'json',
    'text' = 'text',
}

export default class HttpProxy {
    private isXhrError = false;

    constructor() {
        this.proxyFetch();
        this.proxyXmlHttp();
    }

    // 重写 fetch
    proxyFetch() {
        const that = this;
        replaceOriginal(_global, 'fetch', (originalFetch) => {
            return function (input: RequestInfo, config?: RequestInit) {
                const startTime = getTimestamp();
                let requestUrl: string;
                let method: string;
                let headers: IAnyObject | Headers;
                let body: any;
                if (input instanceof Request) {
                    requestUrl = input.url;
                    method = input.method.toUpperCase();
                    headers = input.headers;
                    body = input.body;
                } else {
                    requestUrl = input;
                    method = (config?.method || 'GET').toUpperCase();
                    headers = config?.headers || new Headers();
                    body = config?.body || null;
                }

                const domain = getDomainUrl(requestUrl);

                // 获取请求头信息
                const headersObj: { [key: string]: string } = {};
                if (headers instanceof Headers) {
                    headers.forEach((value, key) => {
                        const hKey = formatHeadersKey(key);
                        if (_support.options.filterHttpHeadersWhite?.length) {
                            !filterWhiteList(_support.options.filterHttpHeadersWhite, key) && (headersObj[hKey] = value);
                        } else {
                            headersObj[hKey] = value
                        }
                    });
                } else if (headers) {
                    for (const key in headers) {
                        if (headers.hasOwnProperty(key)) {
                            const hKey = formatHeadersKey(key);
                            if (_support.options.filterHttpHeadersWhite?.length) {
                                !filterWhiteList(_support.options.filterHttpHeadersWhite, key) && (headersObj[hKey] = headers[key]);
                            } else {
                                headersObj[hKey] = headers[key]
                            }
                        }
                    }
                }

                // 获取请求参数
                let params: any = null;
                if (method === 'GET') {
                    params = getQueryParams(requestUrl);
                } else if (method === 'POST' || method === 'PUT') {
                    const contentType = headersObj['Content-Type'];
                    if (contentType?.indexOf('application/x-www-form-urlencoded') > -1) {
                        params = parseUrlEncodedBody(body);
                    } else {
                        try {
                            params = JSON.parse(body);
                        } catch (e) {
                            // 不是 JSON 格式
                            params = body;
                        }
                    }
                }

                const originPathName = `${domain.origin}${domain.pathname}`;

                return originalFetch.apply(_global, [input, config])
                    .then((res: Response) => {
                        // console.log("===fetch res type===", res.type);
                        // console.log("===fetch res status===", res.status);
                        // console.log("===fetch res statustext===", res.statusText);
                        // console.log("===fetch res url===", res.url);
                        // console.log("===fetch res headers===", headers);
                        const clone = res.clone();
                        clone.text().then((bodyRes) => {
                            if(that.isFilterHttpUrl(requestUrl)) return;

                            const endTime = getTimestamp();
                            const time = endTime - startTime;
                            let body = stringToJSON(bodyRes);

                            if (_support.options.transformResponse) {
                                body = _support.options.transformResponse(originPathName, body);
                                !!body && reportLogs({
                                    type: ReportTypeEnum.FETCH,
                                    data: {
                                        network: NetworkErrorEnum.SUCCESS,
                                        status: res.status,
                                        url: originPathName,
                                        method,
                                        headers: headersObj,
                                        params,
                                        body,
                                        time,
                                    }
                                })
                            } else {
                                if (body?.code !== 200) {
                                    reportLogs({
                                        type: ReportTypeEnum.FETCH,
                                        data: {
                                            network: NetworkErrorEnum.SUCCESS,
                                            status: res.status,
                                            url: originPathName,
                                            method,
                                            headers: headersObj,
                                            params,
                                            body,
                                            time,
                                        }
                                    })
                                }
                            }
                        })
                        return res;
                    }, (err: Error) => {
                        if(that.isFilterHttpUrl(requestUrl)) return;

                        const endTime = getTimestamp();
                        const time = endTime - startTime;
                        reportLogs({
                            type: ReportTypeEnum.FETCH,
                            data: {
                                network: NetworkErrorEnum.ERROR,
                                url: originPathName,
                                method,
                                headers: headersObj,
                                params,
                                time,
                                err: parseStackError(err),
                                isCross: that.isCrossOriginFetchError(err),
                            }
                        })
                        throw err;
                    })
            }
        });
    }

    // 重写 XMLHttpRequest
    proxyXmlHttp() {
        const that = this;
        const originalXHRProto = _global.XMLHttpRequest.prototype;

        replaceOriginal(originalXHRProto, 'open', (originalOpen) => {
            return function (this: XMLHttpRequest, ...args: any[]): void {
                // @ts-ignore
                this._web_eye_sdk_xhr = {
                    startTime: getTimestamp(),
                    url: args[1],
                    method: args[0].toUpperCase(),
                }
                originalOpen.apply(this, args);
            }
        });
        replaceOriginal(originalXHRProto, "setRequestHeader", (originalHeader) => {
            return function (this: XMLHttpRequest, ...args: any[]): void {
                // @ts-ignore
                if (!this._web_eye_sdk_xhr?.headers) {
                    // @ts-ignore
                    this._web_eye_sdk_xhr.headers = {};
                }
                const hKey:string = formatHeadersKey(args[0]);
                if (_support.options.filterHttpHeadersWhite?.length) {
                    // @ts-ignore
                    !filterWhiteList(_support.options.filterHttpHeadersWhite, hKey) && (this._web_eye_sdk_xhr.headers[hKey] = args[1]);
                } else {
                    // @ts-ignore
                    this._web_eye_sdk_xhr.headers[hKey] = args[1];
                }
                originalHeader.apply(this, args);
            }
        })
        replaceOriginal(originalXHRProto, 'send', (originalSend) => {
            return function (this: XMLHttpRequest, ...args: any[]): void {
                // @ts-ignore
                const {startTime, url, method, headers} = this._web_eye_sdk_xhr;
                // 获取请求参数
                let params: any = null;
                if (method === 'GET') {
                    params = args[0] ? parseUrlEncodedBody(args[0]) : getQueryParams(url);
                } else if (method === 'POST' || method === 'PUT') {
                    const contentType = headers['Content-Type'];
                    if (contentType?.indexOf('application/x-www-form-urlencoded') > -1) {
                        params = parseUrlEncodedBody(args[0] as string);
                    } else {
                        params = stringToJSON(args[0]);
                    }
                }
                const domain = getDomainUrl(url);
                on(this, 'readystatechange', () => {
                    if (that.isFilterHttpUrl(url)) return;

                    const endTime = getTimestamp();
                    const time = endTime - startTime;
                    const originPathName = `${domain.origin}${domain.pathname}`;

                    if (this.readyState === 4) {
                        if (this.status >= 200 && this.status < 300) {
                            const responseType = that.responseXhrType(this.responseType);
                            const isTextJson = responseType === 'text' || responseType === 'json';
                            // text json 类型的格式才需要转换
                            let body = isTextJson ? stringToJSON(this.responseText) : responseType;
                            if (_support.options.transformResponse) {
                                body = _support.options.transformResponse(originPathName, body);
                                !!body && reportLogs({
                                    type: ReportTypeEnum.XHR,
                                    data: {
                                        network: NetworkErrorEnum.SUCCESS,
                                        status: this.status,
                                        url: originPathName,
                                        method,
                                        headers,
                                        params,
                                        body,
                                        time,
                                    }
                                })
                            } else {
                                if (body?.code !== 200 || !isTextJson) {
                                    reportLogs({
                                        type: ReportTypeEnum.XHR,
                                        data: {
                                            network: NetworkErrorEnum.SUCCESS,
                                            status: this.status,
                                            url: originPathName,
                                            method,
                                            headers,
                                            params,
                                            body,
                                            time,
                                        }
                                    })
                                }
                            }
                        } else if (this.status === 0) {
                            that.isXhrError = true;

                            reportLogs({
                                type: ReportTypeEnum.XHR,
                                data: {
                                    network: NetworkErrorEnum.ERROR,
                                    status: this.status,
                                    url: originPathName,
                                    method,
                                    headers,
                                    params,
                                    time,
                                    isCross: that.isCrossOriginXhrError(this),
                                },
                            })    
                        } else {
                            logger.log('xhr status', this.status);
                        }
                    }
                })
                on(this, "error", (err) => {
                    if (that.isFilterHttpUrl(url)) return;
                    if (that.isXhrError) {
                        that.isXhrError = false;
                        return;
                    }

                    const endTime = getTimestamp();
                    const time = endTime - startTime;

                    reportLogs({
                        type: ReportTypeEnum.XHR,
                        data: {
                            network: NetworkErrorEnum.ERROR,
                            status: this.status,
                            url,
                            method,
                            headers,
                            params,
                            time,
                            isCross: that.isCrossOriginXhrError(err),
                        },
                    })
                })

                originalSend.apply(this, args);
            }
        });
    }

    /**
     * 判断给定的 URL 是否需要过滤
     *
     * @param url 待判断的 URL 字符串
     * @returns 如果 URL 包含特定的 DSN 或者 filterHttpUrl 列表为空，则返回 true 拦截，否则返回 false 不拦截
     */
    isFilterHttpUrl(url: string): boolean {
        // 判断当前域名是上报的域名
        if (url.indexOf(_support.options.dsn) !== -1) return true;
        // 没有白名单直接返回false
        if (!_support.options.filterHttpUrlWhite?.length) return false;
        // filterHttpUrl 中可能会有正则, 字符串
        return filterWhiteList(_support.options.filterHttpUrlWhite, url);
    }

    /**
     * 判断是否是跨域请求错误
     *
     * @param error 错误对象
     * @returns 如果是跨域请求错误则返回true，否则返回false
     */
    isCrossOriginFetchError(error: Error) {
        return error.message === 'Failed to fetch' || error.message === 'Network request failed';
    }

    /**
     * 判断是否是一个跨域 XMLHttpRequest 产生的错误
     *
     * @param xhr XMLHttpRequest 实例
     * @returns 如果是跨域 XMLHttpRequest 产生的错误则返回 true，否则返回 false
     */
    isCrossOriginXhrError(xhr: XMLHttpRequest) {
        return xhr.status === 0 
        && xhr.statusText === '' 
        && (isFunction(xhr?.getAllResponseHeaders) && xhr.getAllResponseHeaders() === '');
    }

    responseFetchType(contentType: string): FetchResponseType {
        return contentType as FetchResponseType;
    }

    /**
     * 根据给定的类型返回相应的 XMLHttpRequest 响应类型。
     *
     * @param type 字符串类型，表示期望的 XMLHttpRequest 响应类型。
     * @returns 返回对应的 XMLHttpRequestResponseType 枚举值。
     * 如果传入的类型为空字符串，则返回 'text' 类型。
     */
    responseXhrType(type: string): XMLHttpRequestResponseType {
        if (type === '') return XMLHttpRequestResponseType.text;

        return type as XMLHttpRequestResponseType;
    }
}