import { WebEyeConfig } from "../types";
import workerCode from './worker.inline';

export function loadWorker(config: WebEyeConfig) {
    // 判断是否支持 Worker
    if (typeof Worker === 'undefined') {
        return null;
    }
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worder = new Worker(URL.createObjectURL(blob));

    worder.postMessage({type: "init", data: config});

    return worder;
}