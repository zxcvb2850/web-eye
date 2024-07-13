import {_global, _support, isNumber, isString, zip} from '../utils';
import {Callback, IAnyObject, ReportCustomDataFace, ReportSystemDataFace, ReportTypeEnum} from '../types'
import logger from '../logger'

class ReportLogs {
  private _cache: ReportSystemDataFace[] = []; // 缓存需要上报的内容
  constructor() {
  }

  /**
   * 系统上报
   * @param {ReportDataFace} data 需要上报的内容
   * @param {boolean} isSong 是否立即上报
   * */
  sendSystem(data: ReportSystemDataFace, isSong = false) {    
    if (data.type === ReportTypeEnum.PERFORMANCE || data.type === ReportTypeEnum.HASHCHANGE || data.type === ReportTypeEnum.HISTORY || data.type === ReportTypeEnum.RESOURCES) {
      this.requestIdleCallback(this.reportSendBeacon, data, isSong);
    } else if (data.type === ReportTypeEnum.CLICK || data.type === ReportTypeEnum.ACTION_RECORD) {
      this.requestIdleCallback(this.reportSendZip, data, isSong);
    } else {
      this.requestIdleCallback(this.reportSendFetch, data, isSong);
    }      
  }

  // 自定义日志上报
  sendCustom(data: ReportCustomDataFace, reportType = 'fetch') {
    if (!(isString(data.event) || isNumber(data.event))) {
      logger.warn(`custom report event typeof is string or number`);
      return;
    }

    this.requestIdleCallback(this.reportSendFetch, {
      type: ReportTypeEnum.CUSTOM,
      data,
    });
  }

  // 利用空闲时间上报
  private requestIdleCallback(reportFn: Callback, params: ReportSystemDataFace, isSong = false) {
    if (!isSong && 'requestIdleCallback' in _global) {
      requestIdleCallback(reportFn.bind(this, params));
    } else {
      reportFn.bind(this, params);
    }
  }

  // 整理上报的数据
  private sendReportParams(data: ReportSystemDataFace): string {
    const reportParams = {
      type: data.type,
      appId: _support.options.appid,
      visitorId: _support.visitorId,
      uuid: _support.uuid,
      data: isString(data.data) ? data.data : this.getParamsString(data.data),
      params: this.getParamsString(_support.params),
      device: this.getParamsString({ ..._support.devices, sdkVersion: _support.version }),
      path: _global.location.href,
    }

    return this.getParamsString(reportParams);
  }

  // 获取上报需要的参数
  private getParamsString(data: IAnyObject): string {
    return new URLSearchParams(data).toString();
  }

  // fetch 方式上报
  private reportSendFetch(data: ReportSystemDataFace) {
    try {
      if (_global.hasOwnProperty('fetch')) {
        fetch(`${_support.options.dsn}/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: this.sendReportParams(data) }),
        }).catch(err => {
          logger.warn('---fetch 上报失败---', err);
        })
      } else {
        this.reportSendXhr(data);
      }
    } catch (err) {
      logger.warn('---fetch 上报失败---', err);
    }
  }

  // xhr 方式上报
  private reportSendXhr(data: ReportSystemDataFace) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${_support.options.dsn}/xhr`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ data: this.sendReportParams(data) }));
    } catch (err) {
      logger.warn('---xhr 上报失败---', err);
    }
  }

  /**
   * image 方式上报
   *   少量数据上报时可以采用此方式
   *   不能自定义header
   * */
  private reportSendImg(data: ReportSystemDataFace) {
    try {
      const image = new Image();
      image.src = `${_support.options.dsn}/image?data=${this.sendReportParams(data)}}`;
    } catch (err) {
      logger.warn('---image 上报失败---', err);
    }
  }

  /**
   * sendBeacon 方式上报
   *  只能上报少量数据，点击事件，屏幕绘制不建议走次方式上报
   *  不能自定义header
   * */
  private reportSendBeacon(data: ReportSystemDataFace) {
    try {
      if (!!navigator?.sendBeacon && !_global?.isBlockBeacon) {
        const beaconSent = navigator.sendBeacon(`${_support.options.dsn}/beacon`, JSON.stringify({data: this.sendReportParams(data)}));
        if (!beaconSent) {
          this.reportSendFetch(data);
        }
      } else {
        this.reportSendFetch(data);
      }
    } catch (err) {
      logger.warn('---beacon 上报失败---', err);
    }
  }

  // 压缩数据上报
  private reportSendZip(data: ReportSystemDataFace) {
    if (_global.hasOwnProperty('fetch')) {
      const withData = this.sendReportParams(data);
      const compressedData = zip({data: withData});
      fetch(`${_support.options.dsn}/pako`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: compressedData,
      }).catch((err) => {
        logger.warn('pako err: ', err);
      })
    }
  }
}

const instance = new ReportLogs();
const reportLogs = (data: ReportSystemDataFace, isSong?: boolean) => {
  instance.sendSystem(data, isSong);
}
reportLogs.sendCustom = instance.sendCustom.bind(instance);
export default reportLogs;