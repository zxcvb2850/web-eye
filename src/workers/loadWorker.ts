import { WebEyeConfig } from "../types";
import workerCode from './worker.inline';

export function isWorkerSupported() {
    return typeof Worker !== 'undefined';
}

export function loadWorker(config?: WebEyeConfig) {
    // 判断是否支持 Worker
    if (!isWorkerSupported()) {
        return null;
    }
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worded = new Worker(URL.createObjectURL(blob));

    if (config) {
        worded.postMessage({type: "init", data: config});
    }

    return worded;
}