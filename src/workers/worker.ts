import { sleep } from '../utils/common';

self.onmessage = async (e) => {
    await sleep(1000);
    self.postMessage(`Worker 收到: ${e.data}`);
};
