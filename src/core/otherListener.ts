import {
  _global,
  _support,
  getTimestamp,
  on,
  throttle,
  debounce,
  docScreenW,
  docScreenH,
  isEmptyObj,
} from '../utils';
import { ReportEventEnum } from '../types';
import reportLogs from '../report';
import logger from '../logger';

interface ClickFace {
  id: string | null;
  className: (string | null)[];
  tagName: string;
  x: number;
  y: number;
  time: number;
  uuid: string;
  url: string;
}

export default class OtherListener {
  private clicks: ClickFace[] = [];
  private relateId: Set<string> = new Set(); // 关联的错误id

  constructor() {
    this.listener();
    this.beforeUnLoad();
    this.clickEvent();
    this.touchEvent();
    this.resizeEvent();
  }

  listener() {
    // 代码报错后，6s 后上报行为数据
    _support.events.on(ReportEventEnum.CODE, (errorId: string) => {
      this.relateId.add(errorId);
      if (!_support._click_delay_timer) _support._click_delay_timer = {};
      _support._click_delay_timer[errorId] = setTimeout(() => {
        this.reportClickData(errorId);
      }, 5000);
    });

    // 自定义触发上报行为数据
    _support.events.on('SEDN_REPORT_CLICK', (id: string) => {
      this.relateId.add(id);
      this.reportClickData(id, true);
    });

    // 页面被关闭，则立即上报
    _support.events.on('report_click_song', () => {
      this.relateId.forEach(relateId => {
        this.reportClickData(relateId, true);
      })
    });
  }

  reportClickData(relateId: string, isSong = false) {
    clearTimeout(_support._click_delay_timer[relateId]);
    delete _support._click_delay_timer[relateId];

    if (this.clicks.length) {
      reportLogs(
        {
          event: ReportEventEnum.CLICK,
          data: this.clicks,
          relateId,
        },
        isSong,
      );
    } else {
      logger.log('行为数据为空，没有需要上报的数据。');
    }

    this.relateId.delete(relateId);
    if (!this.relateId.size) {
      this.clicks = [];
    }
  }

  // 浏览器关闭/刷新前触发的回调
  beforeUnLoad() {
    on(_global, 'beforeunload', (event: Event) => {
      // 关闭前如果有延迟上报的，则执行立即上报
      if (_support._record_delay_timer && isEmptyObj(_support._record_delay_timer)) {
        _support.events.emit('report_record_song');
      }
      if (_support._click_delay_timer && isEmptyObj(_support._click_delay_timer)) {
        _support.events.emit('report_click_song');
      }
    });
  }

  // 点击事件监听 - WEB
  clickEvent() {
    if (
      !_support.options.isRecordClick ||
      _support.options?.maxClickLimit! <= 0
    )
      return;
    on(_global.document, 'click', this.handleClick, true);
  }

  // 点击事件监听 - 移动端
  touchEvent() {
    if (
      !_support.options.isRecordClick ||
      _support.options?.maxClickLimit! <= 0
    )
      return;
    on(_global.document, 'touchstart', this.handleClick, true);
  }

  // 防止快速点击，添加节流
  handleClick = throttle((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target) {
      this.clicks.push({
        id: target.id,
        className: Array.from(target.classList),
        tagName: target.tagName,
        x: event?.clientX || 0,
        y: event?.clientY || 0,
        uuid: _support.uuid,
        time: getTimestamp(),
        url: _global.location.href,
      });
      const len = this.clicks.length;
      if (len > _support.options.maxClickLimit!) {
        this.clicks = this.clicks.splice(len - _support.options.maxClickLimit!);
      }
    }
  }, 500);

  // 浏览器窗口变化监听
  resizeEvent() {
    on(_global, 'resize', this.handleResize);
  }
  // 尺寸变化，添加防抖
  handleResize = debounce(() => {
    _support.devices.docScreen = `${docScreenW()}x${docScreenH()}`;
  }, 2000);
}
