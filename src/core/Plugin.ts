import {IPlugin} from "../types";

/**
 * 插件基类
 * */
export abstract class Plugin implements IPlugin {
    abstract name: string;
    protected monitor: any;
    protected logger: any;
    protected installed = false;

    /**
     * 安装插件
     * */
    install(monitor: any): void {
        if (this.installed) {
            console.warn(`Plugin ${this.name} has been installed.`);
            return;
        }

        this.monitor = monitor;
        this.logger = this.monitor.logger;
        this.installed = true;
        this.init();
    }

    /**
     * 卸载插件
     * */
    uninstall():void {
        if (!this.installed) {
            this.logger.warn(`Plugin ${this.name} has not been installed.`);
            return;
        }

        this.destroy();
        this.installed = false;
        this.monitor = null;
    }

    /**
     * 插件初始化
     * */
    protected abstract init(): void;

    /**
     * 插件销毁
     * */
    protected abstract destroy(): void;

    /**
     * 检查插件是否已安装
     * */
    isInstalled(): boolean {
        return this.installed;
    }

    /**
     * 上报数据
     * */
    protected report(data: any): void {
        if (this.monitor?.report) {
            this.monitor.report(data);
        }
    }

    /**
     * 安全地执行函数
     * */
    protected safeExecute(fn: () => void): void {
        try {
            fn();
        } catch (error) {
            this.logger.error(`Error in plugin ${this.name}: `, error);
        }
    }
}
