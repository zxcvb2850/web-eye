/**
 * webpack-sourcemap-upload-plugin
 * Webpack 打包完成后 SourceMap 上传插件
 * */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
import {SourcemapUploadPluginOptions} from "../types";

class WebpackSourcemapUploadPlugin {
    private options: SourcemapUploadPluginOptions;

    constructor(options: SourcemapUploadPluginOptions) {
        this.options = {
            uploadUrl: options.uploadUrl,
            appKey: options.appKey,
            version: options.version || '0.0.1',
            env: options.env || 'production',
            deleteLocalSourceMap: options.deleteLocalSourceMap || (options.env === 'production'),
        }
    }

    apply(compiler: any) {
        compiler.hooks.afterEmit.tapAsync('WebpackSourcemapUploadPlugin', (compilation: any, callback: () => void) => {
            this.uploadSourceMap(compilation)
                .then(() => callback())
                .catch((err: Error) => {
                    console.error('Source map upload failed: ', err);
                    callback();
                })
        })
    }

    async uploadSourceMap(compilation: any): Promise<void> {
        const outputPath = compilation.options.output.path;
        const sourceMapFiles = [];

        // 查找输出目录中的所有 .map 文件
        for (const filename of Object.keys(compilation.assets)) {
            if (filename.endsWith('.map')) {
                const filePath = path.join(outputPath, filename);
                if (fs.existsSync(filePath)) {
                    sourceMapFiles.push({
                        filename,
                        filePath,
                        content: fs.readFileSync(filePath)
                    });
                }
            }
        }

        if (sourceMapFiles.length === 0) {
            console.log('No Source map files found');
            return;
        }

        console.log(`Found ${sourceMapFiles.length} source map files, uploading...`);

        // 批量上传
        for (const file of sourceMapFiles) {
            await this.uploadFile(file);

            // 删除本地map文件
            if (this.options.deleteLocalSourceMap) {
                fs.unlinkSync(file.filePath);
                console.log(`Deleted local source map file: ${file.filePath}`);
            }
        }

        console.log('Source map upload completed.');
    }

    async uploadFile(file: any) {
        const formData = new FormData();
        formData.append('file', file.content, file.filename);
        formData.append('version', this.options.version);
        formData.append('env', this.options.env);

        try {
            const response = await axios.post(this.options.uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'AuthAppKey': `Bearer_${this.options.appKey}`,
                }
            });
            console.log(`Uploaded: ${file.filename} - ${response.data.message}`);
        } catch (error) {
            console.error(`Failed to upload ${file.filename}:`, (error as Error).message);
            throw error;
        }
    }
}

module.exports = WebpackSourcemapUploadPlugin;