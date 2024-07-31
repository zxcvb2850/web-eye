/**
 * 发布订阅事件
 * */
import { EventsBusFace } from '../types';

export class EventsBus implements EventsBusFace {
  private events: any = {};

  on(eventName: string, handler: Function) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(handler);
  }

  off(eventName: string, handler: Function) {
    const handlers = this.events[eventName];
    if (!handlers) {
      return;
    }
    for (let i = 0; i < handlers.length; i++) {
      if (handlers[i] === handler) {
        handlers.splice(i, 1);
        break;
      }
    }
  }

  emit(eventName: string, ...args: any[]) {
    const handlers = this.events[eventName];
    if (!handlers || handlers.length === 0) {
      return;
    }
    handlers.forEach((handler: Function) => {
      handler(...args);
    });
  }

  once(eventName: string, handler: Function) {
    const fn = (...args: any[]) => {
      handler(...args);
      this.off(eventName, fn);
    };
    this.on(eventName, fn);
  }

  removeAll(eventName: string) {
    this.events[eventName] = [];
  }

  clear() {
    this.events = {};
  }

  size() {
    return Object.keys(this.events).length;
  }
}
