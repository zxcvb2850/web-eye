import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from "./components/ErrorBoundary/index.js";
import {Monitor} from '../../../src/core/Monitor';
import {LoggerPlugin} from "../../../src/plugins/LoggerPlugin.js";
import {RequestPlugin} from "../../../src/plugins/RequestPlugin.js";
import {ResourcePlugin} from "../../../src/plugins/ResourcePlugin.js";
import {CustomReportPlugin} from "../../../src/plugins/CustomReportPlugin.js";
import {ErrorPlugin} from "../../../src/plugins/ErrorPlugin.js";

const monitor = new Monitor({
    appId: "y",
    reportUrl: "http://localhost:8080/report",
})
const loggerPlugin = new LoggerPlugin();
window.customReportPlugin = new CustomReportPlugin({});
const requestPlugin = new RequestPlugin();
const resourcePlugin = new ResourcePlugin();
const errorPlugin = new ErrorPlugin();

monitor
    .use(loggerPlugin)
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
