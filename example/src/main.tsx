import ReactDOM from 'react-dom/client'
import {HashRouter} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import App from './App.tsx'
import KingWebEye from '../../src/index';
import './index.css'

console.info('---KingWebEye---', KingWebEye);
KingWebEye.init({
    dsn: "http://test-web-eye",
    appid: "test-web-eye",
    isPlayback: false,
})

KingWebEye.setParams("source", 1);
KingWebEye.setParams("channelId", "1000");

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <HashRouter>
            <h2 onClick={() => {
                // KingWebEye.setOptions("level", 4);
            }}>=====</h2>
            <App/>
        </HashRouter>
    </ErrorBoundary>
)
