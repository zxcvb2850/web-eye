import { record, EventType } from 'rrweb';
import { _support } from '../utils';
import { LOG_LEVEL_ENUM, ReportEventEnum } from '../types';
import reportLogs from '../report';
import logger from '../logger';

export default class ActionRecord {
  private curRecord: ReturnType<typeof record>;
  private list: any[] = [];
  private metaSnapshot: any = null;
  private fullSnapshot: any = null;
  private relateId: Set<string> = new Set(); // 用于上报行为数据的关联id

  constructor() {
    this.startRecord();

    this.listener();
  }

  // 监听回调的方式上传行为日志
  listener() {
    // 代码报错后，6s 后上报行为数据
    _support.events.on(ReportEventEnum.CODE, (errorId: string) => {
      this.relateId.add(errorId);
      if (!_support._record_delay_timer) _support._record_delay_timer = {};
      _support._record_delay_timer[errorId] = setTimeout(() => {
        this.reportRecordData(errorId);
      }, 5000);
    });

    // 自定义触发上报行为数据
    _support.events.on('SEDN_REPORT_ACTION', (id: string) => {
      this.relateId.add(id);
      this.reportRecordData(id, true);
    });

    // 立即上报，避免用户关闭浏览器，导致行为未上报
    _support.events.on('report_record_song', () => {
      this.relateId.forEach((val) => {
        this.reportRecordData(val, true);
      });
    });
  }

  // 开始录制
  startRecord() {
    if (
      _support.options?.isActionRecord &&
      _support.options?.maxRecordLimit! > 0
    ) {
      const that = this;
      this.curRecord = record({
        emit(event) {
          if (event.type === EventType.Meta) {
            that.metaSnapshot = event;
          } else if (event.type === EventType.FullSnapshot) {
            that.fullSnapshot = event;
          } else {
            that.list.push(event);
          }
          const len = that.list.length;
          if (len > _support.options.maxRecordLimit!) {
            that.list.shift();
          }
        },
        sampling: {
          scroll: 800, // 每 800ms 最多触发一次
          media: 1000, // 录制媒体间隔时长
          input: 'last', // 连续输入时，只录制最终值
        },
        maskAllInputs: true, // 将所有输入内容记录为 *
        checkoutEveryNth: _support.options.maxRecordLimit, // 每 N 次事件重新制作一次全量快照
      });
    }
  }

  // 停止屏幕录制
  stopRecord() {
    this.curRecord && this.curRecord();

    // 开发环境，停止录制就上报
    if (
      _support.options.logLevel === LOG_LEVEL_ENUM.DEBUG &&
      this.relateId.size
    ) {
      this.relateId.forEach((val) => {
        this.reportRecordData(val);
      });
    }
  }

  reportRecordData(relateId: string, isSong = false) {
    clearTimeout(_support._record_delay_timer[relateId]);
    delete _support._record_delay_timer[relateId];

    if (this.list.length) {
      const data = [this.metaSnapshot, this.fullSnapshot, ...this.list];

      reportLogs(
        {
          event: ReportEventEnum.ACTION_RECORD,
          data,
          relateId,
        },
        isSong,
      );
    } else {
      logger.log('行为数据为空，没有需要上报的数据。');
    }

    this.relateId.delete(relateId);
    if (this.relateId.size === 0) {
      this.list = [];
    }
  }
}
