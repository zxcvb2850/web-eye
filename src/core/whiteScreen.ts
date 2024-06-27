/**
 * 启动白屏检测
 * */
import {_global, _support, getTimestamp, on} from "../utils";

const containerElements = ["html", "body", "#root", ".main-fix"];
const maxLoopCount = 10;

export default function whiteScreen() {
    const startTimerNow = getTimestamp(); // 当前时间
    let loopCount = 0;
    // 页面加载完毕
    if (document.readyState === 'complete') {
        sampleComparison();
    } else {
        on(_global, "load", sampleComparison);
    }

    // 采样对比
    function sampleComparison() {
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
            if(isContainer(xElement as HTMLElement)) emptyPoints++;

            // 中心点只计算一次
            if (i !== centerPoint && isContainer(yElement as HTMLElement)) emptyPoints++;
        }

        (bodyDom as HTMLBodyElement).append(fragment);

        if (emptyPoints !== 19) {
            if(_support._loop_while_screen_timer_) {
                clearInterval(_support._loop_while_screen_timer_);
                _support._loop_while_screen_timer_ = null;
            }
            whiteScreenCheck(false);
        } else {
            if (loopCount > maxLoopCount) {
                whiteScreenCheck(true);
                _support._loop_while_screen_timer_ && clearInterval(_support._loop_while_screen_timer_);
            } else {
                loopCount++;
                !_support._loop_while_screen_timer_ && loopWhileScreen();
            }
        }
    }

    function loopWhileScreen() {
        if (_support._loop_while_screen_timer_) return;
        _support._loop_while_screen_timer_ = setInterval(sampleComparison, 1000);
    }

    function getSelector(element: Element) {
        if (element.id) {
            return `#${element.id}`;
        } else if (element.className) {
            return `.${element.className}`;
        }

        return element.nodeName.toLowerCase();
    }

    function isContainer(element: Element) {
        if (!element) return false;
        const selector = getSelector(element);
        return containerElements.includes(selector);
    }

    // 白屏检测放回状态
    function whiteScreenCheck (status: boolean){
        const now = getTimestamp();
        console.info("---check white screen time---", status, now - startTimerNow);
    }
}
