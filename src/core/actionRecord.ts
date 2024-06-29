import {record} from "rrweb";
import {WebIndexedDB} from "../utils";

const dBName = "king_web_eye";
const dBStoreName = "web_rr_db";

export default class ActionRecord {
    private webIndexedDB = new WebIndexedDB(dBName, dBStoreName);
    public curRecord: ReturnType<typeof record>;

    constructor() {
        this.webIndexedDB.openDatabase((status) => {
            // this.startRecord();
        });

        this.listener();
    }

    listener() {
        /*this.events.on("record-report", () => {

        })*/
    }

    // 开始录制
    startRecord() {
        const that = this;
        this.curRecord = record({
            emit(event, isCheckout) {
                // console.log("--rrweb---", event, isCheckout, webIndexedDB);
                that.webIndexedDB.addItem(event);
            },
            checkoutEveryNms: 30 * 1000, // 每5分钟重新制作快照
            sampling: {
                scroll: 300, // 每 300ms 最多触发一次
                input: "last", // 连续输入时，只录制最终值
            }
        });
    }

    stopRecord() {
        this.curRecord && this.curRecord();
    }
}
