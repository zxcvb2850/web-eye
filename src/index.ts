import pakageJson from "../package.json";
export {Monitor} from "./core/Monitor";
export {WebEyeConfig} from "./types";
export {ConsolePlugin} from "./plugins/ConsolePlugin";
export {RequestPlugin} from "./plugins/RequestPlugin";
export {ResourcePlugin} from "./plugins/ResourcePlugin";
export {ErrorPlugin} from "./plugins/ErrorPlugin";
export {CustomPlugin} from "./plugins/CustomPlugin";
export {WhiteScreenPlugin} from "./plugins/WhiteScreenPlugin";
export {PerformancePlugin} from "./plugins/PerformancePlugin";
export {RecordPlugin} from "./plugins/RecordPlugin";


// 防止浏览器缓存，添加版本号，避免缓存
(function() {
    const script = document.currentScript as HTMLScriptElement;
    if (!script) return;
    const src = script.src;
    
    // 如果URL中没有版本参数，添加一个
    if (src.indexOf('?v=') === -1) {
        var newSrc = src + (src.indexOf('?') === -1 ? '?' : '&') + 'v=' + pakageJson.version;
        var newScript = document.createElement('script');
        newScript.src = newSrc;
        document.head.appendChild(newScript);
        
        script?.parentNode?.removeChild(script);
    }
})();
