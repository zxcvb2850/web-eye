import {Plugin} from "../core/Plugin";
import {ErrorPlugin} from "./ErrorPlugin";
import {generateId, safeJsonStringify} from "../utils/common";
import {MonitorType} from "../types";
import {RecordPlugin} from "./RecordPlugin";

// 自定义上报数据接口
interface CustomReportData {
    id?: string;
    content: string // 上报内容
    extra?: Record<string, any>, // 附加数据
}

// 上报配置接口
interface ReportOptions {
    includeBehavior?: boolean; // 是否包含行为数据
    includeRecord?: boolean; // 是否上报录制数据
}

// 自定义上报插件配置
interface CustomReportConfig {
    maxContentLength: number; // 上报内容最大长度
    maxBehaviorRecords: number; // 最大行为记录数
}

/**
 * 自定义上报数据插件
 * */
export class CustomPlugin extends Plugin {
    name = "CustomPlugin";
    private errorPlugin: ErrorPlugin | null = null;
    private recordPlugin: RecordPlugin | null = null;

    private config: CustomReportConfig = {
        maxContentLength: 10000,        // 10KB
        maxBehaviorRecords: 20,
    };

    constructor(config?:Partial<CustomReportConfig>) {
        super();
        this.config = {...this.config, ...config}
    }


    protected init(): void{
        // 获取 ErrorPlugin 实例（用于获取行为数据）
        this.errorPlugin = this.monitor.getPlugin("ErrorPlugin") as ErrorPlugin;

        // 获取 RecordPlugin 实例
        this.recordPlugin = this.monitor.getPlugin("RecordPlugin") as RecordPlugin;

        this.logger.log('Init CustomPlugin')
    }

    protected destroy(): void{

    }

    /**
     * 自定义上报
     * */
    public async customReport(event: string, data: CustomReportData, options: ReportOptions = {}): Promise<{ success: boolean; reportId: string | null }> {
        try {
            if (!event) {
                throw new Error("Custom report event is required");
            }
            const reportId = data?.id || generateId();

            const content = this.serializeContent(data);
            const reportOtherData = await this.prepareReportData(options, reportId);

            this.report({
                type: MonitorType.CUSTOM,
                data: {
                    id: reportId,
                    event: event.toString(),
                    ...reportOtherData,
                    content,
                    timestamp: Date.now(),
                }
            })

            return {
                success: true,
                reportId,
            }
        } catch (error) {
            this.logger.error('Custom report failed ====>', error);
            return {
                success: false,
                reportId: data?.id || null,
            }
        }
    }

    /**
     * 自定义上报携带其他数据
     * */
    private async prepareReportData(options: ReportOptions, reportId: string): Promise<CustomReportData & { behaviors?: any[] }> {
        const reportData: any = {};

        // 添加用户行为数据
        if (options?.includeBehavior && this.errorPlugin) {
            try {
                this.errorPlugin.behaviorTrigger(reportId);
            } catch (error) {
               this.logger.warn(`Add user behaviors failed ====>`, error);
            }
        }

        // 上报用户录制
        if (options?.includeRecord && this.recordPlugin) {
            try {
                reportData.recordId = await this.recordPlugin.customTrigger(reportId);
            } catch (error) {
                this.logger.warn(`Add user record failed ====>`, error);
            }
        }

        return reportData;
    }

    /**
     * 序列化内容
     */
    private serializeContent(content: any): any {
        if (content === null || content === undefined) {
            return content;
        }

        if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
            return content;
        }

        if (content instanceof Error) {
            return this.serializeError(content);
        }

        if (content instanceof Date) {
            return {
                __type: 'Date',
                value: content.toISOString()
            };
        }

        if (content instanceof RegExp) {
            return {
                __type: 'RegExp',
                value: content.toString()
            };
        }

        if (Array.isArray(content)) {
            return content.map(item => this.serializeContent(item));
        }

        if (typeof content === 'object') {
            return safeJsonStringify(content);
        }

        return String(content);
    }

    /**
     * 序列化错误对象
     */
    private serializeError(error: Error | string): any {
        if (typeof error === 'string') {
            return {
                __type: 'Error',
                message: error,
                timestamp: Date.now()
            };
        }

        return {
            __type: 'Error',
            name: error.name,
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        };
    }

    /**
     * 设置配置
     */
    updateConfig(config: Partial<CustomReportConfig>): void {
        this.config = { ...this.config, ...config };
        this.logger.log('CustomPlugin config updated:', config);
    }

    /**
     * 获取配置
     */
    getConfig(): CustomReportConfig {
        return { ...this.config };
    }
}
