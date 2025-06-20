import { useState, useRef, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import './App.css'

function App() {
    const contentElement = useRef(null);
  const [count, setCount] = useState(0)
    const [obj] = useState({a: 1, b: {c: 2}})

    useEffect(() => {
        window.monitor.updateConfigExtends("source", 1);
    }, [])

    const handleClick = () => {
      // window.monitor.updateConfig({
      //   extend: {
      //     uid: "1213",
      //   }
      // })

      //   /*const obj = {a: 1, b: {c: 2}};
      //   console.info("a: ", obj.a)
      //   console.info("b: ", obj.b)
      //   console.info("c: ", obj.b.c)
      //   console.info("d: ", obj.b.d)
      //   console.info("e: ", obj.b.d.e)*/

      //   // console.log("click react")
      //   // fetch("http://localhost:8080/test");

      //   window.customReportPlugin.customReport("test_custom", new Date(), {
      //       includeBehavior: true,
      //       reportRecord: true,
      //   })

      window.customReportPlugin.customReport("test_custom", {
          "uid": "3798",
          "roomid": "1577092523",
          "data": {
              "0": {
                  "playError": "NotAllowedError",
                  "video": {},
                  "playStep": "canplaythrough"
              },
              "msg": "https://test-img-play.daidaidj.com/img/fc5a99b1ee56a1b461c962f54ad04f47.mp4播放失败 -- 1"
          }
      }, {
          // includeBehavior: true,
          includeRecord: true,
      })
    }

    const clickRecordPlay = () => {
      console.log("===clickRecordPlay===");
    }

  //  return null;
  return (
    <div className={count > 3 ? "white" : ""}>
        {count < 6 && <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
        </button>}
      {<div>
        {count < 4 && <div>
          <a href="https://vite.dev" target="_blank">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>}
        <h1>Vite + React</h1>
        <div className="card e">
          <p className="a b">
            Edit <code>src/App.jsx</code> and save to test HMR
          </p>
        </div>
        <p className="read-the-docs aaa" onClick={handleClick}>
          Click on the Vite and React logos to learn more
        </p>
        <img src="/xxx.png" alt="1111"/>
        <input type="text"/>
        {count > 1 && <>
          <h2>{obj.a}</h2>
          <h2>{JSON.stringify(obj.b)}</h2>
          <h2>{obj.b.c}</h2>
          <h2>{obj.b.d}</h2>
          <h2>{obj.b.d.e}</h2>
        </>}
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
        <h2>111111111111111111111111111</h2>
      </div>}
        {count < 5 && <h2>111111111111111111111111111</h2>}
        <button onClick={clickRecordPlay}>回放</button>
        <div ref={contentElement} id="rrweb-play-content"></div>
    </div>
  )
}

export default App
