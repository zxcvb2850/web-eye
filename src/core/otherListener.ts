import {_global, _support, on, throttle} from "../utils";

interface ClickFace {
    id: string | null;
    className: (string | null)[];
    tagName: string;
}

export default class OtherListener {
    private clicks: ClickFace[] = [];

    constructor() {
        this.beforeUnLoad();
        this.clickEvent();
        this.touchEvent();
    }

    // 浏览器关闭/刷新前触发的回调
    beforeUnLoad() {
        on(_global, "beforeunload", (event: Event) => {
            // 关闭前如果有延迟上报的，则执行立即上报
            if (_support._report_delay_timer) {
                _support.events.emit("report_song");
            }
        })
    }

    // 点击事件监听 - WEB
    clickEvent() {
        if (!_support.options.isRecordClick) return;
        on(_global.document, "click", this.handleClick, true);
    }

    // 点击事件监听 - 移动端
    touchEvent() {
        if (!_support.options.isRecordClick) return;
        // on(_global.document, "touchstart", throttle(this.handleClick, 5000), true);
    }

    handleClick = throttle((event: MouseEvent) => {
        console.info("---event---", event);
        /*const target = (event.target as HTMLElement);
        if (target) {
            this.clicks.push({
                id: target.id,
                className: Array.from(target.classList),
                tagName: target.tagName,
            })
            const len = this.clicks.length;
            console.info("---len---", len);
        }*/
    }, 5000)

}