import {
    _global, _support,
    formatHeadersKey,
    getDomainUrl,
    getQueryParams,
    getTimestamp, on, parseStackError,
    parseUrlEncodedBody,
    replaceOriginal
} from '../utils';
import {IAnyObject, NetworkErrorEnum, ReportTypeEnum} from "../types";
import report from '../report'

// 由于隐私问题，需要过了部分字段
const headersWhite = ["Accept", "Authorization", "Appsubcode", "Appcode"]; // 过滤白名单

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
                        if (headersWhite.indexOf(hKey) !== -1) {
                            headersObj[hKey] = value;
                        }
                    });
                } else if (headers) {
                    for (const key in headers) {
                        if (headers.hasOwnProperty(key)) {
                            const hKey = formatHeadersKey(key);
                            if (headersWhite.indexOf(hKey) !== -1) {
                                headersObj[hKey] = headers[key];
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

                            report({
                                type: ReportTypeEnum.FETCH,
                                data: {
                                    status: NetworkErrorEnum.SUCCESS,
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
                        report({
                            type: ReportTypeEnum.FETCH,
                            data: {
                                status: NetworkErrorEnum.SUCCESS,
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
                const hKey = formatHeadersKey(args[0]);
                if (headersWhite.indexOf(hKey) !== -1) {
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
                on(this, "loadend", () => {
                    if (that.isFilterHttpUrl(url)) return;

                    const endTime = getTimestamp();
                    const time = endTime - startTime;

                    report({
                        type: ReportTypeEnum.XHR,
                        data: {
                            status: NetworkErrorEnum.SUCCESS,
                            url: `${domain.origin}${domain.pathname}`,
                            method,
                            headers,
                            params,
                            time,
                        }
                    })
                });
                on(this, "error", (err) => {
                    if (that.isFilterHttpUrl(url)) return;

                    const endTime = getTimestamp();
                    const time = endTime - startTime;

                    report({
                        type: ReportTypeEnum.XHR,
                        data: {
                            status: NetworkErrorEnum.ERROR,
                            url,
                            method,
                            headers,
                            params,
                            time,
                            isCross: that.isCrossOriginFetchError(err),
                        },
                    })
                })

                originalSend.apply(this, args);
            }
        });
    }

    // 过滤上报域名报错，过滤用户配置域名
    isFilterHttpUrl(url: string): boolean {
        return url.indexOf(_support.options.dsn) !== -1
        || _support.options?.filterHttpUrl?.indexOf(url) === -1
    }

    // fetch 判断是否跨域
    isCrossOriginFetchError(error: Error) {
        return error.message === 'Failed to fetch' || error.message === 'Network request failed';
    }

    // xhr 判断是否跨域
    isCrossOriginXhrError(xhr: XMLHttpRequest) {
        return xhr.status === 0 && xhr.statusText === '' && xhr.getAllResponseHeaders() === '';
    }
}