import { _global, _support, jsonToString, zip, isString, isNumber, on, stringToJSON, isJsonString } from '../utils';
import { Callback, IAnyObject, ReportCustomDataFace, ReportSystemDataFace, ReportTypeEnum, ReportNetEnum } from '../types'
import logger from '../logger';

class ReportLogs {
  private _cache: ReportSystemDataFace[] = []; // 缓存需要上报的内容
  private _isCheckBeacon: boolean = true; // 是否检测 是否支持 beacon
  private _isBeacon: boolean = true; // 是否支持 beacon
  constructor() {
  }

  /**
   * 系统上报
   * @param {ReportDataFace} data 需要上报的内容
   * @param {boolean} isSong 是否立即上报
   * */
  sendSystem(data: ReportSystemDataFace, isSong = false) {
    if (data.type === ReportTypeEnum.PERFORMANCE || data.type === ReportTypeEnum.HASHCHANGE || data.type === ReportTypeEnum.HISTORY || data.type === ReportTypeEnum.RESOURCES) {
      if (_support.options.debug) {
        this.requestIdleCallback(()=> this.reportSendBeacon(data), isSong);
      } else {
        this.requestIdleCallback(()=> this.reportSendBeaconBuffer(data), isSong);
      }
    }
    else if (data.type === ReportTypeEnum.CLICK || data.type === ReportTypeEnum.ACTION_RECORD){
      this.requestIdleCallback(() => this.reportSendBeaconBuffer(data), isSong);
    }
    else {
      if (_support.options.debug) {
        this.requestIdleCallback(() => this.reportSendFetch(data), isSong);
      } else {
        this.requestIdleCallback(() => this.reportSendFetchBuffer(data), isSong);
      }
    }      
  }

  // 自定义日志上报
  sendCustom(event: string | number, data: ReportCustomDataFace, reportType: ReportNetEnum = ReportNetEnum.FETCH) {
    if (!event || !(isString(event) || isNumber(event))) {
      logger.warn(`custom report event typeof is string or number`);
      return;
    }

    this.requestIdleCallback(() => this.reportSendFetch({
      type: ReportTypeEnum.CUSTOM,
      data,
      event,
    }));
  }

  // 利用空闲时间上报
  private requestIdleCallback(reportFn: Callback, isSong = false) {
    if (!isSong && 'requestIdleCallback' in _global) {
      requestIdleCallback(() => reportFn());
    } else {
      reportFn();
    }
  }

  // 整理上报的数据
  private sendReportParams(data: ReportSystemDataFace): string {
    const reportParams: IAnyObject = {
      type: data.type,
      appId: _support.options.appid,
      body: jsonToString(data.data),
      sdkVersion: _support.version,
    }
    if (data.event) reportParams.event = data.event;
    // 这两个事件无需上传额外参数
    if (!(data.type === ReportTypeEnum.CLICK || data.type === ReportTypeEnum.ACTION_RECORD)) {
      reportParams.visitorId = _support.visitorId;
      reportParams.uuid = _support.uuid;
      reportParams.params = this.getParamsString(_support.params);
      reportParams.device = this.getParamsString(_support.devices);
      reportParams.path = _global.location.href;
    }

    data?.errorId && (reportParams['errorId'] = data.errorId);

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
  private reportSendXhr(data: ReportSystemDataFace, suffix = '/xhr') {
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

  // sendBeacon 方式上报，只能上报少量数据
  private reportSendBeacon(data: ReportSystemDataFace) {
    try {
      if (!!navigator?.sendBeacon && this._isBeacon) {
        const beaconSent = navigator.sendBeacon(`${_support.options.dsn}/beacon`, JSON.stringify({data: this.sendReportParams(data)}));
        if (!beaconSent) {
          this._isBeacon = false;
          this.reportSendFetch(data);
        } else {
          // 检测 beacon 上报是否成功
          if (this._isCheckBeacon) {
            this._isCheckBeacon = false;
            setTimeout(() => {
              this.reportSendFetchBuffer(data, "/check-beacon");
            }, 300)
          }
        }
      } else {
        this.reportSendFetch(data);
      }
    } catch (err) {
      logger.warn('---beacon 上报失败---', err);
    }
  }

  // 压缩数据，使用 navigator.sendBeacon 方式上报
  private reportSendBeaconBuffer(data: ReportSystemDataFace) {
    try {
      if (!!navigator?.sendBeacon && this._isBeacon) {
        const compressedData = zip({data: this.sendReportParams(data)});
        const blob = new Blob([compressedData], { type: 'application/octet-stream' });
        const beaconSent = navigator.sendBeacon(`${_support.options.dsn}/beacon-buffer`, blob);
        if (!beaconSent) {
          this._isBeacon = false;
          this.reportSendFetchBuffer(data);
        } else {
          // 检测 beacon 上报是否成功
          if (this._isCheckBeacon) {
            this._isCheckBeacon = false;
            setTimeout(() => {
              this.reportSendFetchBuffer(data, "/check-beacon");
            }, 300)
          }
        }
      } else {
        this.reportSendFetchBuffer(data);
      }
    } catch (err) {
      logger.warn('---beacon 上报失败---', err);
    }
  }

  // fetch 压缩数据方式上报
  private reportSendFetchBuffer(data: ReportSystemDataFace, suffix = '/pako-buffer') {
    if (!_global.hasOwnProperty('fetch')) {
      const compressedData = zip({data: this.sendReportParams(data)});
      fetch(`${_support.options.dsn}${suffix}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: compressedData,
      }).then(async res => {
        if (suffix === '/check-beacon') {
          // 检测 beacon 上报是否成功
          const json = await res.json();
          this._isBeacon = !!json?.data;
          logger.log('---fetch buffer check---', suffix, json);
        }
      }).catch((err) => {
        logger.warn('---fetch buffer 上报失败---', err);
      })
    } else {
      this.reportSendXhrBuffer(data, suffix);
    }
  }

  // xhr 压缩数据方式上报
  private reportSendXhrBuffer(data: ReportSystemDataFace, suffix='/pako-buffer') {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${_support.options.dsn}${suffix}`, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      const compressedData = zip({data: this.sendReportParams(data)});
      xhr.send(compressedData);

      on(xhr, 'loadend', () => {
        if (suffix === '/check-beacon' && xhr.status >= 200 && xhr.status < 300) {
          let json = isJsonString(xhr.responseText) ? stringToJSON(xhr.responseText) : null;
          this._isBeacon = !!json?.data
          logger.log('---xhr buffer check---', suffix, json);
        }
      })
    } catch (err) {
      logger.warn('---xhr 上报失败---', err);
    }
  }
}

const instance = new ReportLogs();
const reportLogs = (data: ReportSystemDataFace, isSong?: boolean) => {
  instance.sendSystem(data, isSong);
}
reportLogs.sendCustom = instance.sendCustom.bind(instance);
export default reportLogs;