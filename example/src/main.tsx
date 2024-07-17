import ReactDOM from 'react-dom/client'
import {HashRouter} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import App from './App.tsx'
import webEyeSDK from '../../src';
import './index.css'

webEyeSDK.init({
    dsn: "http://127.0.0.1:4567/api/report-logs",
    appid: "6695034c40c7768292753691",
    isPlayback: false,
    whiteScreenDoms: ["html", "body", "#root"],
    isActionRecord: true, // 是否开启屏幕动作录制
})

webEyeSDK.setParams("source", 1);
webEyeSDK.setParams("channelId", "1000");

const script = document.createElement("script");
script.src = "/abc.jsx";
document.body.appendChild(script);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <HashRouter>
            <h2 onClick={() => {
                webEyeSDK.setOptions("logLevel", 4);
                webEyeSDK.setOptions("isActionRecord", false);
            }}>=====</h2>
            <App/>
        </HashRouter>
    </ErrorBoundary>
)
