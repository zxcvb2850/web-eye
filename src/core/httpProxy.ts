import {
    _global,
    formatHeadersKey,
    getDomainUrl,
    getQueryParams,
    getTimestamp, on,
    parseUrlEncodedBody,
    replaceOriginal
} from "../utils";
import {IAnyObject, NetworkErrorEnum, ReportTypeEnum} from "../types";

export default class HttpProxy {
    constructor() {
        this.proxyFetch();
        this.proxyXmlHttp();
    }

    // 重写 fetch
    proxyFetch() {
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
                        headersObj[formatHeadersKey(key)] = value;
                    });
                } else if (headers) {
                    for (const key in headers) {
                        if (headers.hasOwnProperty(key)) {
                            headersObj[formatHeadersKey(key)] = headers[key];
                        }
                    }
                }

                // 获取请求参数
                let params: any = null;
                if (method === 'GET') {
                    params = getQueryParams(requestUrl);
                } else if (method === 'POST' || method === 'PUT') {
                    const contentType = headersObj['Content-Type'];
                    if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
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


                return originalFetch.apply(_global, [input, {config}])
                    .then((res: Response) => {
                        const endTime = getTimestamp();
                        const time = endTime - startTime;
                        console.info("---fetch send success---", {
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
                        return res;
                    }, (err: Error) => {
                        const endTime = getTimestamp();
                        const time = endTime - startTime;
                        console.info("---fetch send error---", {
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
                        throw err;
                    })
            }
        });
    }

    // 重写 XMLHttpRequest
    proxyXmlHttp() {
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
                // @ts-ignore
                this.king_web_eye_xhr.headers[formatHeadersKey(args[0])] = args[1];
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
                    const contentType = headers['Content-Type'] || {};
                    if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
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
                    const endTime = getTimestamp();
                    const time = endTime - startTime;

                    console.info("---xhr send success---", {
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
                    const endTime = getTimestamp();
                    const time = endTime - startTime;
                    console.info("---xhr send error---", {
                        type: ReportTypeEnum.XHR,
                        data: {
                            status: NetworkErrorEnum.SUCCESS,
                            url,
                            method,
                            headers,
                            params,
                            time,
                        }
                    })
                    console.error("XHR err", err);
                })

                originalSend.apply(this, args);
            }
        });
    }
}