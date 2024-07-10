/**
 * 启动白屏检测
 * */
import {_global, _support, getTimestamp, on} from "../utils";
import {ReportTypeEnum} from "../types";
import report from '../report'

const maxLoopCount = 10;

export default class WhiteScreen {
    public startTime = getTimestamp();
    public loopCount = 0;
    constructor() {
        // 页面加载完毕
        if (document.readyState === 'complete') {
            this.sampleComparison();
        } else {
            on(_global, "load", () => this.sampleComparison());
        }
    }

    // 采样对比
    sampleComparison() {
        let emptyPoints = 0;
        // 横向、纵向，采样 10 个点
        const countPoints = 10;
        const centerPoint = countPoints / 2;
        const bodyDom = document.querySelector("body");
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 10; i++){
            const xElement = _global.document.elementFromPoint(
                (_global.innerWidth * i) / 10,
                _global.innerHeight / 2
            );
            const yElement = _global.document.elementFromPoint(
                _global.innerWidth / 2,
                (_global.innerHeight * i) / 10
            );
            if(this.isContainer(xElement as HTMLElement)) emptyPoints++;

            // 中心点只计算一次
            if (i !== centerPoint && this.isContainer(yElement as HTMLElement)) emptyPoints++;
        }

        (bodyDom as HTMLBodyElement).append(fragment);

        if (emptyPoints !== 19) {
            if(_support._loop_while_screen_timer_) {
                clearInterval(_support._loop_while_screen_timer_);
                _support._loop_while_screen_timer_ = null;
            }
            this.whiteScreenCheck(false);
        } else {
            if (this.loopCount > maxLoopCount) {
                this.whiteScreenCheck(true);
                _support._loop_while_screen_timer_ && clearInterval(_support._loop_while_screen_timer_);
            } else {
                this.loopCount++;
                !_support._loop_while_screen_timer_ && this.loopWhileScreen();
            }
        }
    }

    loopWhileScreen() {
        if (_support._loop_while_screen_timer_) return;
        _support._loop_while_screen_timer_ = setInterval(this.sampleComparison.bind(this), 1000);
    }

    getSelector(element: Element) {
        if (element.id) {
            return `#${element.id}`;
        } else if (element.className) {
            return `.${element.className}`;
        }

        return element.nodeName.toLowerCase();
    }

    isContainer(element: Element) {
        if (!element) return false;
        const selector = this.getSelector(element);

        return (_support.options.whiteScreenDoms as string[]).includes(selector);
    }

    // 白屏检测返回状态
    whiteScreenCheck (status: boolean){
        const now = getTimestamp();

        if (status) {
            report({
               type: ReportTypeEnum.WHITE_SCREEN,
               data: {
                   status,
                   time: now - this.startTime
               }
           })
        }
    }
}
