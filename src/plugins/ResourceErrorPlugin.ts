import {Plugin} from "../core/Plugin";

/**
 * 资源错误插件
 * */
export class ResourceErrorPlugin extends Plugin {
    name = "ResourceErrorPlugin";
    private errorHandler?: EventListener;
    private performanceObserver?: PerformanceObserver;

    protected init(): void {
        console.info("Init ResourceErrorPlugin");

    }

    protected destroy() : void {
        // 移除错误监听
    }
}