import {_support} from "../utils";

export default class ReportLogs {
    private cache = []; // 缓存需要上报的内容
    constructor() {
    }

    // 系统上报
    sendSystem(data: any){
        this.reportImg(data);
    }

    // 自定义日志上报
    sendCustom(){}

    // 获取上报需要的参数
    getParams(){
        const params = new URLSearchParams(_support.params);
        return params;
    }

    // fetch 方式上报
    reportFetch(){}

    // xhr 方式上报
    reportXhr(){}

    // image 方式上报
    reportImg(data: any){
        console.info("---getParams---", this.getParams().toString());
    }

    // sendBeacon 方式上报
    reportBeacon() {}
}