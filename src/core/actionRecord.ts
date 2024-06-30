import {record} from "rrweb";

export default class ActionRecord {
    private curRecord: ReturnType<typeof record>;
    public list: any[] = [];

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
                that.list.push(event);
            },
            sampling: {
                scroll: 600, // 每 300ms 最多触发一次
                input: "last", // 连续输入时，只录制最终值
            },
            maskAllInputs: true, // 将所有输入内容记录为 *
        });
    }

    stopRecord() {
        this.curRecord && this.curRecord();
        window.localStorage.setItem("test-record", JSON.stringify(this.list));
    }
}
