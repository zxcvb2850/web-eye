import ReactDOM from 'react-dom/client'
import {HashRouter} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import App from './App.tsx'
import KingWebEye from '../../src';
import './index.css'

console.info('---KingWebEye---', KingWebEye);
KingWebEye.init({
    dsn: "http://test-web-eye",
    appid: "test-web-eye",
    isPlayback: false,
    whiteScreenDoms: ["html", "body", "#root"],
    isActionRecord: true, // 是否开启屏幕动作录制
})

KingWebEye.setParams("source", 1);
KingWebEye.setParams("channelId", "1000");

const script = document.createElement("script");
script.src = "/abc.jsx";
document.body.appendChild(script);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <HashRouter>
            <h2 onClick={() => {
                KingWebEye.setOptions("level", 4);
                KingWebEye.setOptions("isActionRecord", false);
            }}>=====</h2>
            <App/>
        </HashRouter>
    </ErrorBoundary>
)
