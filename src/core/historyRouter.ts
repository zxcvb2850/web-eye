import { _global, getCacheData, localStorageRouter, on, replaceOriginal, setCacheData } from '../utils';
import { ReportTypeEnum } from '../types';
import report from '../report';

export default class HistoryRouter {
  constructor() {
    this.handleHashChange();
    this.proxyHistory();
  }

  handleHashChange() {
    on(_global, 'hashchange', (event) => {
      const { oldURL, newURL } = event;
      setCacheData(localStorageRouter, newURL);

      report({
        type: ReportTypeEnum.HASHCHANGE,
        data: { old: oldURL, new: newURL, type: 'hashchange' },
      })
    })
  }

  proxyHistory() {
    const originalHistory = _global.history;
    replaceOriginal(originalHistory, 'pushState', (originalPushState) => {
      return function (this: History, ...args: any[]) {
        const { href, origin } = _global.location;
        const newPath = `${origin}${args[2]}`;
        setCacheData(localStorageRouter, newPath);

        report({
          type: ReportTypeEnum.HISTORY,
          data: { old: href, new: newPath, type: 'pushState' },
        })
        originalPushState.apply(this, args);
      }
    })
    replaceOriginal(originalHistory, 'replaceState', (originalReplaceState) => {
      return function (this: History, ...args: any[]) {
        const { href } = _global.location;
        const { value: oldPath, time } = getCacheData(localStorageRouter);
        setCacheData(localStorageRouter, href);

        report({
          type: ReportTypeEnum.HISTORY,
          data: { old: oldPath, new: href, type: 'replaceState' },
        })
        originalReplaceState.apply(this, args);
      }
    })
  }
}