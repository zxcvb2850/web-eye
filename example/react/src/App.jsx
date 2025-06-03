import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
    const [obj] = useState({a: 1, b: {c: 2}})

    const handleClick = () => {
        // const obj = {a: 1, b: {c: 2}};
        // console.info("a: ", obj.a)
        // console.info("b: ", obj.b)
        // console.info("c: ", obj.b.c)
        // console.info("d: ", obj.b.d)
        // console.info("e: ", obj.b.d.e)

        // console.log("click react")
        // fetch("http://localhost:8080/test");

        window.customReportPlugin.customReport(new Date(), {
            includeBehavior: true,
        })
    }

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
        <div className="card">
          <p>
            Edit <code>src/App.jsx</code> and save to test HMR
          </p>
        </div>
        <p className="read-the-docs" onClick={handleClick}>
          Click on the Vite and React logos to learn more
        </p>
        <img src="/xxx.png" alt="1111"/>
        <input type="text"/>
        {count > 1 && <>
          <h2>{obj.a}</h2>
          <h2>{JSON.stringify(obj.b)}</h2>
          <h2>{obj.b.c}</h2>
          <h2>{obj.b.d}</h2>
          {/*<h2>{obj.b.d.e}</h2>*/}

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
    </div>
  )
}

export default App
