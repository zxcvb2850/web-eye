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

export default class HttpProxy {
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

                return originalFetch.apply(_global, [input, config])
                    .then((res: Response) => {
                        const clone = res.clone();
                        clone.text().then(() => {
                            if(that.isFilterHttpUrl(requestUrl)) return;

                            const endTime = getTimestamp();
                            const time = endTime - startTime;

                            reportLogs({
                                type: ReportTypeEnum.FETCH,
                                data: {
                                    network: NetworkErrorEnum.SUCCESS,
                                    url: `${domain.origin}${domain.pathname}`,
                                    method,
                                    headers: headersObj,
                                    params,
                                    time,
                                }
                            })
                        })
                        return res;
                    }, (err: Error) => {
                        if(that.isFilterHttpUrl(requestUrl)) return;

                        const endTime = getTimestamp();
                        const time = endTime - startTime;
                        reportLogs({
                            type: ReportTypeEnum.FETCH,
                            data: {
                                network: NetworkErrorEnum.SUCCESS,
                                url: `${domain.origin}${domain.pathname}`,
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
                this.king_web_eye_xhr = {
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
                if (!this.king_web_eye_xhr?.headers) {
                    // @ts-ignore
                    this.king_web_eye_xhr.headers = {};
                }
                const hKey:string = formatHeadersKey(args[0]);
                if (_support.options.filterHttpHeadersWhite?.length) {
                    // @ts-ignore
                    !filterWhiteList(_support.options.filterHttpHeadersWhite, hKey) && (this.king_web_eye_xhr.headers[hKey] = args[1]);
                } else {
                    // @ts-ignore
                    this.king_web_eye_xhr.headers[hKey] = args[1];
                }
                originalHeader.apply(this, args);
            }
        })
        replaceOriginal(originalXHRProto, 'send', (originalSend) => {
            return function (this: XMLHttpRequest, ...args: any[]): void {
                // @ts-ignore
                const {startTime, url, method, headers} = this.king_web_eye_xhr;
                // 获取请求参数
                let params: any = null;
                if (method === 'GET') {
                    params = getQueryParams(url);
                } else if (method === 'POST' || method === 'PUT') {
                    const contentType = headers['Content-Type'];
                    if (contentType?.indexOf('application/x-www-form-urlencoded') > -1) {
                        params = parseUrlEncodedBody(args[0] as string);
                    } else {
                        try {
                            params = JSON.parse(args[0] as string);
                        } catch (e) {
                            // 不是 JSON 格式
                            params = args[0];
                        }
                    }
                }
                const domain = getDomainUrl(url);
                on(this, 'readystatechange', () => {
                    if (that.isFilterHttpUrl(url)) return;

                    const endTime = getTimestamp();
                    const time = endTime - startTime;

                    if (this.readyState === 4) {
                        if (this.status >= 200 && this.status < 300) {
                            if (_support.options.transformResponse) {
                                _support.options.transformResponse(this.responseText);
                            } else {
                                const data = stringToJSON(this.responseText);
                                if (data?.code !== 200) {
                                    reportLogs({
                                        type: ReportTypeEnum.XHR,
                                        data: {
                                            network: NetworkErrorEnum.SUCCESS,
                                            status: this.status,
                                            url: `${domain.origin}${domain.pathname}`,
                                            method,
                                            headers,
                                            params,
                                            time,
                                        }
                                    })
                                }
                            }
                        } else if (this.status === 0) {
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
     * @returns 如果 URL 包含特定的 DSN 或者 filterHttpUrl 列表为空，则返回 true，否则返回 false
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

    // xhr 判断是否跨域
    isCrossOriginXhrError(xhr: XMLHttpRequest) {
        return xhr.status === 0 
        && xhr.statusText === '' 
        && (isFunction(xhr?.getAllResponseHeaders) && xhr.getAllResponseHeaders() === '');
    }
}