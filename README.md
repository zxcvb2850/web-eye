> 公共字段
```javascript
[
    {
        "appKey": string, // 应用key
        "visitorId": string, // 指纹ID
        "sessionId": string, // 会话ID
        "deviceInfo": { // 设备信息
            "url": string, // 当前url
            "userAgent": "", // 用户浏览器信息
            "language": "", // 语言
            "platform": "", // 平台
            "screen": { // 屏幕
                "width": number,
                "height": number
            },
            "viewport": { // 视口
                "width": number,
                "height": number
            },
            "timestamp": number,
            "connection": {
                "effectiveType": string,
                "downlink": number,
                "rtt": number
            }
        },
        "extends": {}, // 扩展信息 用户自行设置 {string: string|number|boolean}
        "type": "resource",
        "data": Data // 上报数据, 详情字段见以下文档
    }
]
```
> 资源加载异常上报 source
```javascript
{
    "path": string,
    "resourceType": string,
    "errorType": string,
    "tagName": string,
    "outerHTML": string,
    "timestamp": number,
    "isFromCache": boolean,
    "loadTime": number
}
```

> 自定义上报 custom
```javascript
{
    "event": string, // 自定义key
    "reportId": string, // 上报ID 用于录屏关联
    "content": {
        "__type": string,
        "value": string,
    },
    "timestamp": number
}
```

> 性能上报 performance
```javascript
{
    "id": string,
    "name": string,
    "value": number,
    "rating": string,
    "navigationType": string
    "timestamp": number
}
```

> 录屏错误 record
```javascript
{
    "sessionId": string,
    "triggerType": string, // 上报来源 error|custom|manual
    "relatedId": string, // 关联上报ID
    "events": string, // 错误信息
    "timestamp": number // 事件发生时间
}
```

> 代码错误 code
```javascript
{
    "error": {
        "id": "1749209558321-k980279yc",
        "type": "react_error",
        "message": "Cannot read properties of undefined (reading 'e')",
        "stack": string, // 错误堆栈信息
        "errorInfo": {
            "componentStack": string, // react 组件堆栈
        },
        "timestamp": number,
        "recordSessionId": string, // 关联id
        "originalStack": [
            {
                "stack": string,
                "filename": string,
                "lineno": number,
                "colno": number
            },
        ],
        "lineno": number,
        "colno": number,
        "filename": string
    },
    "behaviors": [ // Array 行为日志
        {
            "type": string,
            "target": string,
            "timestamp": number,
            "data": {
                "tagName": string,
                "className": string,
                "innerText": string
            }
        }
    ]
}
```

> 请求上报 request
```javascript
{
    "url": string, // 错误请求地址
    "method": string, // 请求方法
    "duration": number, // 请求耗时
    "success": true, // 是否成功
    "errorMessage": string, // 错误信息
    "isCorsError": boolean, // 是否跨域
    "status": number, // 状态码
    "requestHeaders": boolean, // 请求头参数
    "requestParams": {
        "query": object, // url 请求参数
        "body": object, // post 请求参数
    },
    "timestamp": number,
}
```

> 白屏上报 white_screen
```javascript
{
    "isWhiteScreen": boolean, // 是否白屏
    "reason": string, // 白屏原因
    "details": {
        "domCount": number, // 检测 dom 元素个数
        "textNodes": number, // 检测文本节点个数
        "imageNodes": number, // 检测图片节点个数
        "timestamp": number, // 白屏检测时间
    },
    "duration": number, // 白屏检测耗时
    "timestamp": number,
}
```

> 行为上报 behavior
```javascript
[
    {
        type: string, // 行为类型 click|scroll|hashchange
        target?: string, // DOM 类型
        timestamp: number,
        data?: {
            tagName?: string, // 节点名称
            className?: string, // classname
            innerText?: string, // 内容
            hash?: string,
            href?: string，
            scrollY?: number,
            scrollX?: number
        },
    }
]
```
