import { strToU8 } from "fflate";
import { BaseMonitorData, IReporter, WebEyeConfig } from "../types";
import { getPageVisibility, safeJsonStringify, sleep, compressData } from "../utils/common";
import { addEventListener } from "../utils/helpers";
import { Logger } from "./Logger";
import { IndexedDBManager } from "../utils/indexedDBManager";

/**
 * 数据上报器
 * */
export class Reporter implements IReporter {
  private worker: Worker | null = null
  private queue: BaseMonitorData[] = []
  private isWorkerReady = false
  private pendingQueue: BaseMonitorData[] = []
  private config: WebEyeConfig
  private logger: Logger

  constructor(config: WebEyeConfig, logger: Logger) {
    this.config = config
    this.logger = logger
    this.initWorker()
    this.bindVisibilityChange()
  }

  private initWorker() {
    if (typeof Worker === 'undefined') {
      this.logger.warn('Web Workers are not supported in this environment')
      return
    }

    try {
      // 使用 webpack 的 worker-loader 或类似的构建工具来加载 worker
      this.worker = new Worker(
        new URL('../../worker/reportWorker.ts', import.meta.url),
        {
          type: 'module',
        }
      )

      this.worker.onmessage = (e) => {
        const { type, payload } = e.data

        if (type === 'REPORT_SUCCESS') {
          this.logger.log('Report successful:', payload.result)
          this.processQueue()
        } else if (type === 'REPORT_ERROR') {
          this.logger.error('Report failed:', payload.error)
          this.retryLater(payload.data)
        }
      }

      this.worker.onerror = (error) => {
        this.logger.error('Worker error:', error)
        this.isWorkerReady = false
      }

      this.isWorkerReady = true
      this.processQueue()
    } catch (error) {
      this.logger.error('Failed to initialize worker:', error)
    }
  }

  async report(data: BaseMonitorData[]): Promise<void> {
    const items = Array.isArray(data) ? data : [data]
    this.queue.push(...items)

    if (this.isWorkerReady) {
      this.processQueue()
    } else if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      // 如果页面隐藏但worker还没准备好，使用sendBeacon兜底
      this.sendViaBeacon(items)
    }
  }

  private processQueue() {
    if (!this.isWorkerReady || this.queue.length === 0) return

    const batchSize = this.config.batchSize || 10
    const batch = this.queue.splice(0, batchSize)

    this.worker?.postMessage({
      type: 'REPORT',
      payload: {
        data: batch,
        config: {
          reportUrl: this.config.reportUrl,
          // 其他需要的配置
        },
      },
    })
  }

  private sendViaBeacon(data: BaseMonitorData[]) {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return false
    }

    const blob = new Blob([JSON.stringify(data)], {
      type: 'application/json',
    })

    return navigator.sendBeacon(this.config.reportUrl, blob)
  }

  private retryLater(data: BaseMonitorData[]) {
    // 指数退避重试
    const retryCount = data[0]?.retryCount || 0
    if (retryCount >= (this.config.maxRetry || 3)) {
      this.logger.warn('Max retry count reached, giving up on:', data)
      return
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // 最大30秒

    setTimeout(() => {
      data.forEach((item) => {
        item.retryCount = (item.retryCount || 0) + 1
      })
      this.report(data)
    }, delay)
  }

  private bindVisibilityChange() {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面可见时处理队列
        this.processQueue()
      } else if (
        document.visibilityState === 'hidden' &&
        this.queue.length > 0
      ) {
        // 页面隐藏时，如果还有未处理的数据，使用sendBeacon发送
        this.sendViaBeacon([...this.queue])
        this.queue = []
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return

    if (this.isWorkerReady) {
      this.processQueue()
    } else {
      this.sendViaBeacon([...this.queue])
      this.queue = []
    }
  }

  destroy(): void {
    this.worker?.terminate()
    this.isWorkerReady = false
  }
}
