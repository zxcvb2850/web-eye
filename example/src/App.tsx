import {useEffect, useRef} from "react";
import {Route, Routes, useNavigate} from "react-router-dom";
import rrwebPlayer from "rrweb-player";
import 'rrweb-player/dist/style.css';
import {record, EventType} from 'rrweb'
import 'rrweb/dist/rrweb.min.css';
import IndexPage from "./views/IndexPage";
import AboutPage from "./views/AboutPage";
import LayoutPage from "./views/LayoutPage";
import './App.css'

function App() {
    const navigate = useNavigate();
    const ref = useRef<HTMLDivElement>(null);
    const recordFn = useRef<any | null>(null);
    const recentEvents = useRef<any[]>([]);
    const metaSnapsho = useRef<any | null>(null);
    const fullSnapsho = useRef<any | null>(null);

    useEffect(() => {
        // init();
    }, []);

    const clickButton = () => {
        console.log("---clickButton---");
        /*const text = "Hello World";
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const compressedData = gzip_compress(data);
        console.info("---compressdData---", compressedData);
        fetch("/test-report", {
            method: "POST",
            headers: {
                "Content-Encoding": "gzip",
                "Content-Type": "application/octet-stream",
            },
            body: compressedData,
        })
            .then(res => res.text())
            .then(res => console.info("---res---", res));*/
    }

    const clickLoadSourceError = () => {
        const image = new Image();
        image.src = "http://test-img-play.daidaidj.com/img/f3ce557e2c8b4f2c20a0f2acbe8dc926.jpg/224x224";
        image.alt = "图片";

        const bodyDom: HTMLBodyElement | null = document.querySelector("body");
        bodyDom && bodyDom.append(image);
    }

    const clickPromiseCatch = () => {
        Promise.reject("---test promise reject---");
    }

    const clickCodeError = () => {
        // eslint-disable-next-line
        const testObj: any = {a: 1, b: {a: 2}};
        console.info("---testObj---", testObj.a, testObj.b.a, testObj.b.c.d);
    }

    // 路由跳转
    const clickChangeRouter = () => {
        navigate("/404", {replace: false});
    }

    // 开始录制
    const clickRecord = async () => {
        recordFn.current = record({
            emit(event) {
                if (event.type === EventType.Meta) {
                    console.info("===meta===", event);
                    metaSnapsho.current = event;
                } else if (event.type === EventType.FullSnapshot) {
                    console.info("===FullSnapshot===", event);
                    fullSnapsho.current = event;
                } else {
                    recentEvents.current.push(event);
                }
                if (recentEvents.current.length > 20) {
                    recentEvents.current.shift();
                }
            },
            sampling: {
                scroll: 600, // 每 300ms 最多触发一次
                media: 1000, // 录制媒体间隔时长
                input: "last", // 连续输入时，只录制最终值
            },
            maskAllInputs: true, // 将所有输入内容记录为 *
            checkoutEveryNth: 200, // 每 N 次事件重新制作一次全量快照
        });

    }
    // 播放回放
    const clickPlayback = () => {
        const record = window.localStorage.getItem("test-record");
        if (record) {
            const events = JSON.parse(record);
            if (events?.length){
                new rrwebPlayer({
                    target: ref.current!,
                    props: {
                        events,
                        skipInactive: true,
                        loadTimeout: 1000,
                        UNSAFE_replayCanvas: true,
                    },
                })
            } else {
                console.warn("*************************");
            }
        }
    }

    return (
        <>
            <button onClick={clickLoadSourceError}>加载资源异常</button>
            <button onClick={clickPromiseCatch}>promise catch</button>
            <button onClick={clickCodeError}>代码报错</button>
            <button onClick={clickButton}>点击按钮</button>
            <button onClick={clickChangeRouter}>路由跳转</button>
            <button onClick={clickRecord}>开始录制</button>
            <button onClick={clickPlayback}>播放回放</button>
            <input type="text"/>
            <input type="password"/>
            <div ref={ref}/>

            {/* 路由 */}
            <Routes>
                <Route path='/' element={<LayoutPage/>}>
                    <Route path='index' element={<IndexPage/>}>
                        {/* 默认 子路由 ，在页面 路由为 /goods ，会展示该子路由 */}
                        <Route index element={<h3>List</h3>}/>

                        <Route path=":id" element={<h3>Detail</h3>}/>
                    </Route>

                    <Route path='about' element={<AboutPage/>}></Route>
                    <Route path="*" element={<h3>404</h3>}/>
                </Route>
            </Routes>
        </>
    )
}

export default App
