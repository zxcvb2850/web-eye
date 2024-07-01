import {record, EventType} from "rrweb";

export default class ActionRecord {
    private curRecord: ReturnType<typeof record>;
    private list: any[] = [];
    private metaSnapsho: any = null;
    private fullSnapsho: any = null;

    constructor() {
        this.startRecord();

        this.listener();
    }

    // 监听回调的方式上传行为日志
    listener() {
        // 上报错误时刻的前后日志
        /*this.events.on("record-report", () => {

        })*/
    }

    // 开始录制
    startRecord() {
        const that = this;
        this.curRecord = record({
            emit(event) {
                if (event.type === EventType.Meta) {
                    that.metaSnapsho = event;
                }
                else if (event.type === EventType.FullSnapshot) {
                    that.fullSnapsho = event;
                } else {
                    that.list.push(event);
                }
            },
            sampling: {
                scroll: 600, // 每 300ms 最多触发一次
                media: 1000, // 录制媒体间隔时长
                input: "last", // 连续输入时，只录制最终值
            },
            maskAllInputs: true, // 将所有输入内容记录为 *
            checkoutEveryNth: 100, // 每 N 次事件重新制作一次全量快照
        });
    }

    stopRecord() {
        this.curRecord && this.curRecord();
        window.localStorage.setItem("test-record", JSON.stringify([this.metaSnapsho, this.fullSnapsho, ...this.list]));
    }
}
