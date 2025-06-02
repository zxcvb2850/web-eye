import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {initEyeLogs} from '../../../src/index';
import ErrorBoundary from "./components/ErrorBoundary/index.js";

window._eyeLogReport = initEyeLogs({
    appId: "y",
    reportUrl: "http://localhost:8080/report",
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
  </StrictMode>,
)
