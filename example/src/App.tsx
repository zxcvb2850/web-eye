import {useEffect, useRef} from "react";
import {Route, Routes, useNavigate} from "react-router-dom";
import rrwebPlayer from "rrweb-player";
import 'rrweb-player/dist/style.css';
import IndexPage from "./views/IndexPage";
import AboutPage from "./views/AboutPage";
import LayoutPage from "./views/LayoutPage";
// import init, {gzip_compress} from "./pkg/wasm_sdk_util";
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
    }

    const clickLoadSourceError = () => {
        const image = new Image();
        image.src = "example.com/test.png";

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

    const dbName = "king_web_eye";
    const storeName = "web_rr_db";
    // 播放回放
    const clickPlayback = async () => {
        /*const db: IDBDatabase = await openDatabase(dbName, storeName, 1);
        const events1 = await getAllItems(db, storeName);
        console.info("====events1===", events1);
        new rrwebPlayer({
            target: ref.current!,
            props: {events: events1},
        })*/

        const events2 = JSON.parse(window.localStorage.getItem("test-record")!);
        console.info("====events2===", events2);
        new rrwebPlayer({
            target: ref.current!,
            props: {events: events2},
        })
    }

    function openDatabase(dbName: string, storeName: string, version: number): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, version);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, {keyPath: 'id', autoIncrement: true});
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    function getAllItems(db: IDBDatabase, storeName: string): Promise<never[]> {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve((event.target as IDBRequest).result);
            };

            request.onerror = (event) => {
                reject((event.target as IDBRequest).error);
            };
        });
    }


    return (
        <>
            <button onClick={clickLoadSourceError}>加载资源异常</button>
            <button onClick={clickPromiseCatch}>promise catch</button>
            <button onClick={clickCodeError}>代码报错</button>
            <button onClick={clickButton}>点击按钮</button>
            <button onClick={clickChangeRouter}>路由跳转</button>
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
