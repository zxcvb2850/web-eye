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

const monitor = new Monitor({
    appId: "y",
    reportUrl: "http://localhost:8080/report",
})
const loggerPlugin = new LoggerPlugin();
const whiteScreenPlugin = new WhiteScreenPlugin({
    enableMutationObserver: true,
    timeout: 5000,
    whiteScreenDoms: ["#root", "#app"],
});
window.customReportPlugin = new CustomPlugin({});
const requestPlugin = new RequestPlugin();
const resourcePlugin = new ResourcePlugin();
window.errorPlugin = new ErrorPlugin();

monitor
    .use(loggerPlugin)
    .use(whiteScreenPlugin)
    .use(customReportPlugin)
    .use(requestPlugin)
    .use(resourcePlugin)
    .use(errorPlugin)
    .install();

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
  </StrictMode>,
)
