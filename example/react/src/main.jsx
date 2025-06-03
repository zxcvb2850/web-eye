import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from "./components/ErrorBoundary/index.js";
import {Monitor} from '../../../src/core/Monitor';
import {LoggerPlugin} from "../../../src/plugins/LoggerPlugin.js";
import {RequestPlugin} from "../../../src/plugins/RequestPlugin.js";
import {ResourcePlugin} from "../../../src/plugins/ResourcePlugin.js";
import {CustomPlugin} from "../../../src/plugins/CustomPlugin.ts";
import {ErrorPlugin} from "../../../src/plugins/ErrorPlugin.js";
import {WhiteScreenPlugin} from "../../../src/plugins/WhiteScreenPlugin.js";
import {PerformancePlugin} from "../../../src/plugins/PerformancePlugin.js";
import {RecordPlugin} from "../../../src/plugins/RecordPlugin.js";

const monitor = new Monitor({
    appId: "y",
    reportUrl: "http://localhost:8080/report",
})
const loggerPlugin = new LoggerPlugin();
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
    .use(loggerPlugin)
    .use(whiteScreenPlugin)
    .use(performancePlugin)
    .use(customReportPlugin)
    .use(requestPlugin)
    .use(resourcePlugin)
    .use(errorPlugin)
    .use(recordPlugin)
    .install();

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
  </StrictMode>,
)
