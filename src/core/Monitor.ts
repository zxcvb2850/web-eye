import {BaseMonitorData, IPlugin, MonitorData, WebEyeConfig} from "../types";
import {Reporter} from "./Reporter";
import {generateId, generateSessionId} from "../utils/common";
import {getDeviceInfo} from "../utils/device";

/**
 * 主监控类
 * */
export class Monitor {
    private config: WebEyeConfig;
    private reporter: Reporter;
    private plugins: Map<string, IPlugin> = new Map();
    private sessionId: string;
    private installed = false;

    constructor(config: WebEyeConfig) {
        this.config = this.mergeConfig(config);
        this.sessionId = generateSessionId();
        this.reporter = new Reporter(this.config);
    }

    /**
     * 合并配置
     * */
    private mergeConfig(config: WebEyeConfig): WebEyeConfig {
        return {
            maxRetry: 3,
            retryDelay: 1000,
            enableHash: true,
            enableHistory: true,
            whiteScreenThreshold: 1000,
            performanceThreshold: 1000,
            enableAutoReport: true,
            batchSize: 10,
            flushInterval: 10000,
            ...config,
        }
    }

    /**
     * 安装监控
     * */
    install(): Monitor {
        if (this.installed) {
            console.warn('Monitor is already installed');
            return this;
        }

        this.installed = true;

        // 安装所有插件
        this.plugins.forEach(plugin => {
            plugin.install(this);
        })

        console.info('Monitor installed successfully');
        return this;
    }

    /**
     * 卸载监控
     * */
    uninstall(): void {
        if (!this.installed) {
            console.warn('Monitor is not installed');
            return;
        }

        // 卸载所有插件
        this.plugins.forEach(plugin => {
            plugin.uninstall();
        })

        // 销毁上报器
        this.reporter.destroy();

        this.installed = false;
        console.info('Monitor uninstalled successfully');
    }

    /**
     * 使用插件
     * */
    use(plugin: IPlugin): Monitor {
        if (this.plugins.has(plugin.name)) {
            console.warn(`Plugin ${plugin.name} is already registered.`);
            return this;
        }

        this.plugins.set(plugin.name, plugin);

        // 如果监控已安装，立即安装插件
        if (this.installed) {
            plugin.install(this);
        }

        return this;
    }

    /**
     * 移除插件
     * */
    removePlugin(name: string): Monitor {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.uninstall();
            this.plugins.delete(name);
        }

        return this;
    }

    /**
     * 获取插件
     * */
    getPlugin(name: string): IPlugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * 上报数据
     * */
    async report(data: Partial<MonitorData>): Promise<void> {
        if (!this.installed) {
            console.warn(`Monitor is not installed.`);
            return;
        }

        const monitorData = this.createMonitorData(data);
        await this.reporter.report(monitorData);
    }

    /**
     * 批量上报数据
     * */
    private createMonitorData(data: Partial<MonitorData>): BaseMonitorData {
        return {
            appId: this.config.appId,
            id: generateId(),
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            sessionId: this.sessionId,
            deviceInfo: getDeviceInfo(),
            ...data,
        } as BaseMonitorData;
    }

    /**
     * 手动刷新上报队列
     * */
    async flush(): Promise<void> {
        await this.reporter.flush();
    }

    /**
     * 获取配置
     * */
    getConfig(): WebEyeConfig {
        return {...this.config};
    }

    /**
     * 更新配置
     * */
    updateConfig(config: Partial<WebEyeConfig>): void {
        this.config = {...this.config, ...config};
    }

    /**
     * 获取会话ID
     * */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * 重新生成会话ID
     * */
    regenerateSessionId(): string {
        this.sessionId = generateSessionId();
        return this.sessionId;
    }

    /**
     * 检查是否已安装
     * */
    isInstalled(): boolean {
        return this.installed;
    }

    /**
     * 获取所有插件
     * */
    getPlugins(): IPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * 获取插件数量
     * */
    getPluginCount(): number {
        return this.plugins.size;
    }
}



































