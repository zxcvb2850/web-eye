import {
  _global,
  _support,
  getErrorType,
  getMd5,
  on,
  parseStackError,
  getTimestamp,
  getUuid,
} from '../utils';
import {
  ErrorTypeEnum,
  ReportEventEnum,
  StackFrameFace,
  UnKnown,
  ReactErrorBoundary,
} from '../types';
import logger from '../logger';
import reportLogs from '../report';

export default class HandleListener {
  private cacheMap = new Map<string, number>();

  constructor() {
    this.windowError();
    this.rejectError();
    this.listener();
  }

  private listener() {
    _support.events.on('REACT_ERROR_BOUNDARY', this.reactCodeError.bind(this));
  }

  private windowError() {
    on(
      _global,
      'error',
      (event: ErrorEvent) => {
        if (!_global.isErrorHandledByBoundary) {
          if (this.adaptReact()) return true;
          const eventType = getErrorType(event);
          if (eventType === ErrorTypeEnum.RS) {
            // 资源加载异常
            this.resourcesError(event, eventType);
          } else if (eventType === ErrorTypeEnum.CS) {
            // 跨域
            this.resourcesError(event, eventType);
          } else if (eventType === ErrorTypeEnum.JS) {
            this.scriptCodeError(event, eventType);
          }
        }
        _global.isErrorHandledByBoundary = false;
      },
      true,
    );
  }

  // Promise reject 错误监听
  private rejectError() {
    on(_global, 'unhandledrejection', (event: PromiseRejectionEvent) => {
      const errorContent: { msg: string; frames?: StackFrameFace[] } = {
        msg: UnKnown,
      };
      const stacks = parseStackError(event.reason);
      if (stacks?.length) {
        errorContent.msg = stacks[0].source;
        errorContent.frames = stacks;
      } else {
        errorContent.msg = event.reason;
      }
      const id = getMd5(`${errorContent.msg}`);

      this.reportRecordData(id, ReportEventEnum.PROMISE, {
        ...errorContent,
        status: event?.reason.name || UnKnown,
      });
    });
  }

  // 资源加载错误
  private resourcesError(event: ErrorEvent, type: ErrorTypeEnum) {
    if (
      _support.options?.transformResource &&
      _support.options?.transformResource(event, type)
    )
      return;
    if (type === ErrorTypeEnum.CS) {
      logger.warn('跨域资源加载失败');
    } else {
      const cTarget = event.target || event.srcElement;
      const url =
        (cTarget as HTMLImageElement).src ||
        (cTarget as HTMLAnchorElement).href;
      const localName = (cTarget as HTMLElement).localName;
      const id = getMd5(`${url}${localName}`);

      this.reportRecordData(id, ReportEventEnum.RESOURCES, {
        id,
        type,
        url,
        localName,
      });
    }
  }

  // 代码执行错误
  private scriptCodeError(event: ErrorEvent, type: ErrorTypeEnum) {
    const stacks = parseStackError(event.error);
    const { message, filename, lineno, colno } = event;
    const id = getMd5(`${message}${filename}${lineno}${colno}`);

    const errorId = getUuid();
    const isReport = this.reportRecordData(
      id,
      ReportEventEnum.CODE,
      {
        msg: message,
        frames: JSON.stringify(stacks),
        status: event?.error?.name || UnKnown,
      },
      errorId,
    );

    if (isReport) {
      // 发送事件
      _support.events.emit(ReportEventEnum.CODE, errorId);
    }
  }

  // React ErrorBoundary 错误边界
  private reactCodeError(error: Error, errorInfo: ReactErrorBoundary) {
    const stacks = parseStackError({ stack: errorInfo.componentStack });
    if (stacks?.length) {
      const id = getMd5(
        `${error.message}${stacks[0].fileName}${stacks[0].lineno}${stacks[0].colno}`,
      );
      const errorId = getUuid();

      const isReport = this.reportRecordData(
        id,
        ReportEventEnum.REACT,
        {
          msg: error.message,
          frames: JSON.stringify(stacks),
        },
        errorId,
      );

      if (isReport) {
        // 发送事件
        _support.events.emit(ReportEventEnum.CODE, errorId);
      }
    }
  }

  // 上报错误
  private reportRecordData(
    id: string,
    event: ReportEventEnum,
    data: any,
    relateId?: string,
  ): boolean {
    const oldTime = this.cacheMap.get(id);
    const now = getTimestamp();
    let isReport = false;
    // 60s 内只上报一次
    if (!oldTime || now - oldTime > 60 * 1000) {
      isReport = true;
      this.cacheMap.set(id, now);
    }

    if (isReport) {
      reportLogs({ event, data, relateId });
    }

    return isReport;
  }

  // 处理 react 开发环境会执行两次
  private adaptReact(): boolean {
    if (
      ((error) =>
        error.stack && error.stack.indexOf('invokeGuardedCallbackDev') >= 0)(
        new Error(),
      )
    ) {
      return true;
    }
    return false;
  }
}
