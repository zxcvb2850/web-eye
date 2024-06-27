import {record, pack} from "rrweb";
import {_support, WebIndexedDB} from "../utils";

export default async function rrweb() {
    const webIndexedDB = new WebIndexedDB("king_web_eye", "web_rr_db");
    await webIndexedDB.openDatabase();

    record({
        emit(event, isCheckout) {
            // console.log("--rrweb---", event, isCheckout, webIndexedDB);
            // webIndexedDB?.db && webIndexedDB.addItem(event);
        },
        checkoutEveryNms: 30 * 1000, // 每5分钟重新制作快照
        sampling: {
            scroll: 300, // 每 300ms 最多触发一次
            input: "last", // 连续输入时，只录制最终值
        }
    });
}
