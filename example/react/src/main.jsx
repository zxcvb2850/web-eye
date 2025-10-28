import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from "./components/ErrorBoundary/index.js";
import { Monitor, ConsolePlugin, WhiteScreenPlugin, CustomPlugin, PerformancePlugin, RequestPlugin, ResourcePlugin, ErrorPlugin, RecordPlugin } from '../../../dist/index';

const monitor = new Monitor({
    debug: true,
    appKey: "684a798724dd89c2252dc797",
    reportUrl: "http://localhost:8989/a/r",
    extends: {
        uid: "1111",
        channelId: "10000",
    }
})
const consolePlugin = new ConsolePlugin({
    recordInConsole: ['warn'],
    maxRecords: 20,
});
const whiteScreenPlugin = new WhiteScreenPlugin({
    enableMutationObserver: false,
    timeout: 5000,
});
window.customReportPlugin = new CustomPlugin({});
const performancePlugin = new PerformancePlugin();
const requestPlugin = new RequestPlugin();
const resourcePlugin = new ResourcePlugin();
window.errorPlugin = new ErrorPlugin();
window.recordPlugin = new RecordPlugin();

monitor
    .use(consolePlugin)
    .use(whiteScreenPlugin)
    // .use(performancePlugin)
    .use(customReportPlugin)
    .use(requestPlugin)
    .use(resourcePlugin)
    .use(errorPlugin)
    .use(recordPlugin)
    .install();

window.monitor = monitor;

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
  </StrictMode>,
)
