import {useEffect, useRef} from "react";
import {Route, Routes, useNavigate} from "react-router-dom";
import rrwebPlayer from "rrweb-player";
import 'rrweb-player/dist/style.css';
import 'rrweb/dist/rrweb.min.css';
import IndexPage from "./views/IndexPage";
import AboutPage from "./views/AboutPage";
import LayoutPage from "./views/LayoutPage";
import KingWebEye from '../../src';
import './App.css'

function App() {
    const navigate = useNavigate();
    const ref = useRef<HTMLDivElement>(null);

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

        KingWebEye.sendCustom(2222, {a: 111, b: '222'});
    }

    const clickLoadSourceError = () => {
        const image = new Image();
        image.src = "http://test-img-play.daidaidj.com/img/f3ce557e2c8b4f2c20a0f2acbe8dc926.jpg/224x224";
        image.alt = "图片";

        const bodyDom: HTMLBodyElement | null = document.querySelector("body");
        bodyDom && bodyDom.append(image);
    }

    const clickPromiseCatch = async () => {
        Promise.reject("promise reject");


        const result = await promiseError();
        console.info("===result===", result);

        function promiseError(){
            return new Promise((resolve, reject) => {
                if (Math.random() > 0.5) {
                    resolve("resolve");
                } else {
                    reject(new Error("reject"));
                }
            })
        }
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
    const clickRecord = async () => {}
    // 播放回放
    const clickPlayback = () => {
        KingWebEye.setOptions("isActionRecord", false);
        setTimeout(() => {
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
        }, 200);
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
