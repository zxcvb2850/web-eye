import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from "./components/ErrorBoundary/index.js";

// 从 'web-eye-logs' 导入 SDK，Vite 会根据别名配置解析到 src/index.ts
import {
    Monitor,
    ConsolePlugin,
    WhiteScreenPlugin,
    CustomPlugin,
    PerformancePlugin,
    RequestPlugin,
    ResourcePlugin,
    ErrorPlugin,
    RecordPlugin
} from 'web-eye-logs';

// 1. 初始化 Monitor
const monitor = new Monitor({
    debug: true, // 开启调试模式，会打印日志
    appKey: "684a7987-24dd-89c2-252d-c797", // 替换为您的应用 KEY
    reportUrl: "http://localhost:8989/report/", // 替换为您的上报地址
    extends: { // 自定义扩展信息，会附加到每条日志
        uid: "1111",
        channelId: "10000",
    }
});

// 2. 创建插件实例
const consolePlugin = new ConsolePlugin({
    recordInConsole: ['warn'], // 劫持 console.warn
    maxRecords: 20,
});
const whiteScreenPlugin = new WhiteScreenPlugin({
    enableMutationObserver: false,
    timeout: 5000,
});
const customReportPlugin = new CustomPlugin({});
const performancePlugin = new PerformancePlugin();
const requestPlugin = new RequestPlugin();
const resourcePlugin = new ResourcePlugin();
const errorPlugin = new ErrorPlugin();
const recordPlugin = new RecordPlugin();

// 3. 使用 .use() 注册插件
monitor
    .use(consolePlugin)
    .use(whiteScreenPlugin)
    .use(performancePlugin)
    .use(customReportPlugin)
    .use(requestPlugin)
    .use(resourcePlugin)
    .use(errorPlugin)
    .use(recordPlugin)
    .install(); // 4. 调用 install() 启动监控

// 将 monitor 实例挂载到 window，方便在控制台调试
window.monitor = monitor;

// 渲染 React 应用
createRoot(document.getElementById('root')).render(
  <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
  </StrictMode>,
)
