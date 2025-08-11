import workerCode from './worker.inline';

export function loadWorker() {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
}