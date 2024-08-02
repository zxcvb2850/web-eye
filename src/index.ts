import {
  _global,
  _support,
  EventsBus,
  getCacheData,
  getUuid,
  isObject,
  localStorageUUID,
  setCacheData,
  validateOptions,
} from './utils';
import {
  LOG_LEVEL_ENUM,
  OptionsFace,
  ParamsFace,
  ReportCustomDataFace,
  ReactErrorBoundary,
} from './types';
import logger from './logger';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import WebVitals from './core/webVitals';
import HttpProxy from './core/httpProxy';
import HistoryRouter from './core/historyRouter';
import HandleListener from './core/handleListener';
import WhiteScreen from './core/whiteScreen';
import ActionRecord from './core/actionRecord';
import OtherListener from './core/otherListener';
import reportLogs from './report';

type CustomSendRealtedType = 'all' | 'click' | 'action';

/**
 * 入口文件
 * */
class webEyeSDK {
  protected _initialized = false; // 是否已经初始化
  public options: OptionsFace;
  private actionRecord: ActionRecord | null = null;

  constructor() {
    this.options = {
      dsn: '',
      appid: '',
      logLevel: LOG_LEVEL_ENUM.DEBUG,
      isConsole: true,
      maxRecordLimit: 70,
      isRecordClick: true,
      maxClickLimit: 100,
      filterHttpUrlWhite: [
        new RegExp('chunk.js.map$'),
        new RegExp('.chunk.js$'),
        new RegExp('.hot-update.json$'),
      ],
    };

    _support.options = this.options;
    _support.events = new EventsBus();

    if (!isObject(_support.params)) {
      _support.params = {};
    }
    // 浏览器指纹
    const { value } = getCacheData(localStorageUUID);
    if (value) {
      _support['visitorId'] = value;
    } else {
      FingerprintJS.load()
        .then((fp) => fp.get())
        .then((result) => {
          if (result?.visitorId) {
            setCacheData(localStorageUUID, result.visitorId);
            _support['visitorId'] = result.visitorId;
          }
        });
    }
    // 本次uuid
    const uuid = getUuid();
    if (uuid) _support['uuid'] = uuid;

    // WEB性能监听
    new WebVitals();
    // 路由监听
    new HistoryRouter();
    // 错误监听
    new HandleListener();
  }

  init(options: OptionsFace) {
    if (this._initialized) {
      logger.warn(`Already initialized`);
      return;
    }
    this._initialized = true;

    if (!options.dsn) {
      logger.error(`dsn is must be set`);
      return;
    }
    if (!options.appid) {
      logger.error(`appid is must be set`);
      return;
    }
    validateOptions(options.dsn, 'dsn', 'string', false) &&
      (this.options.dsn = options.dsn);
    validateOptions(options.appid, 'appid', 'string', false) &&
      (this.options.appid = options.appid);
    if (validateOptions(options.debug, 'debug', 'boolean', true)) {
      logger.setLevel(LOG_LEVEL_ENUM.DEBUG);
      this.options.debug = options.debug;
    }
    if (validateOptions(options.logLevel, 'logLevel', 'number', true)) {
      this.options.logLevel = options.logLevel;
      !this.options.debug && logger.setLevel(options.logLevel as number);
    }
    validateOptions(options.isConsole, 'isConsole', 'boolean', true) &&
      (this.options.isConsole = options.isConsole);
    validateOptions(options.consolesHide, 'consolesHide', 'array', true) &&
      (this.options.consolesHide = options.consolesHide);
    if (
      validateOptions(options.whiteScreenDoms, 'whiteScreenDoms', 'array', true)
    ) {
      this.options.whiteScreenDoms = options.whiteScreenDoms;
      // 白屏检测
      if (options?.whiteScreenDoms?.length) {
        new WhiteScreen();
      }
    }
    if (
      validateOptions(options.isActionRecord, 'actionRecord', 'boolean', true)
    ) {
      this.options.isActionRecord = options.isActionRecord;
      // 是否开启录制
      if (options.isActionRecord) {
        this.actionRecord = new ActionRecord();
      }
    }
    validateOptions(options.maxRecordLimit, 'maxRecordLimit', 'number', true) &&
      (this.options.maxRecordLimit = options.maxRecordLimit);
    validateOptions(options.isRecordClick, 'isRecordClick', 'boolean', true) &&
      (this.options.isRecordClick = options.isRecordClick);
    validateOptions(options.maxClickLimit, 'maxClickLimit', 'number', true) &&
      (this.options.maxClickLimit = options.maxClickLimit);
    validateOptions(
      options.filterHttpUrlWhite,
      'filterHttpUrlWhite',
      'array',
      true,
    ) &&
      (this.options.filterHttpUrlWhite = [
        ...this.options.filterHttpUrlWhite!,
        ...options.filterHttpUrlWhite!,
      ]);
    validateOptions(
      options.filterHttpHeadersWhite,
      'filterHttpHeadersWhite',
      'array',
      true,
    ) && (this.options.filterHttpHeadersWhite = options.filterHttpHeadersWhite);
    validateOptions(
      options.transformResponse,
      'transformResponse',
      'function',
      true,
    ) && (this.options.transformResponse = options.transformResponse);
    validateOptions(
      options.transformResource,
      'transformResource',
      'function',
      true,
    ) && (this.options.transformResource = options.transformResource);

    // 日志初始化
    logger.init();

    // 请求监听
    new HttpProxy();

    // 其他监听
    new OtherListener();
  }

  setOptions(key: keyof OptionsFace, value: OptionsFace[keyof OptionsFace]) {
    if (key === 'appid') {
      logger.warn(`appid can not be modified`);
      return;
    }
    if (key === 'dsn') {
      logger.warn(`Unable to set dsn field`);
      return false;
    }
    if (this.options.hasOwnProperty(key)) {
      if (key === 'debug' && validateOptions(value, key, 'boolean', false)) {
        if (value === false && this.options.logLevel != null) {
          logger.setLevel(this.options.logLevel);
        } else if (value === true) {
          logger.setLevel(LOG_LEVEL_ENUM.DEBUG);
        }
      }
      if (
        !this.options.debug &&
        key === 'logLevel' &&
        validateOptions(value, key, 'number', false)
      ) {
        logger.setLevel(value as number);
      }

      if (
        key === 'isActionRecord' &&
        value === false &&
        this.actionRecord?.stopRecord
      ) {
        this.actionRecord.stopRecord();
      }

      if (key === 'filterHttpUrlWhite') {
        this.options.filterHttpUrlWhite = [
          ...this.options.filterHttpUrlWhite!,
          ...(value as (string | RegExp)[]),
        ];
      }

      (this.options[key] as OptionsFace[keyof OptionsFace]) = value;
    }
  }

  setParams(key: keyof ParamsFace, value: any) {
    if (key === 'visitorId' || key === 'uuid') {
      logger.warn(`Unable to set ${key} field`);
      return false;
    }
    _support.params[key] = value;
  }

  /**
   * 自定义类型上报
   * @param event 上报类型
   * @param data 上报内容
   * @param options 上报配置
   */
  sendCustom(
    event: string | number,
    data: ReportCustomDataFace,
    options: { related?: CustomSendRealtedType } = {},
  ) {
    let relateId = null;
    if (options?.related) relateId = getUuid();
    reportLogs.sendCustom(event, data, relateId);
    if (relateId) {
      this.sendCustomRecord(relateId, options.related);
    }
  }

  // 自定义执行行为上报 - 点击事件，屏幕录制，方便线上调试
  sendCustomRecord(
    id: string | null = null,
    type: CustomSendRealtedType = 'all',
  ) {
    if (!id) id = getUuid();
    if (type === 'all') {
      _support.events.emit('SEDN_REPORT_CLICK', id);
      _support.events.emit('SEDN_REPORT_ACTION', id);
    } else if (type === 'action') {
      _support.events.emit('SEDN_REPORT_ACTION', id);
    } else if (type === 'click') {
      _support.events.emit('SEDN_REPORT_CLICK', id);
    }
  }

  /**
   * 发送 React 错误边界信息
   *
   * @param error 错误对象
   */
  sendReactErrorBoundary(error: Error, errorInfo: ReactErrorBoundary) {
    _global.isErrorHandledByBoundary = true;
    _support.events.emit('REACT_ERROR_BOUNDARY', error, errorInfo);
  }
}

const instance = new webEyeSDK();

_global.__web_eye_sdk__ = Object.assign(instance, _support);

export default instance;
