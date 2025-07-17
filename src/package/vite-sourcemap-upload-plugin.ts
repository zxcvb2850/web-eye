/**
 * vite-sourcemap-upload-plugin
 * Vite 打包完成后 SourceMap 上传插件
 * */
import fs from "fs";
import path from "path";
import {glob} from "glob";
import axios from "axios";
import FormData from "form-data";
import {SourcemapUploadPluginOptions} from "../types";

export function ViteSourcemapUploadPlugin(options: SourcemapUploadPluginOptions) {
    if (!options.uploadUrl || !options.appKey) {
        throw new Error("uploadUrl and appKey are required");
    }

    const env = options.env || 'production';
    const config: SourcemapUploadPluginOptions = {
        uploadUrl: options.uploadUrl,
        appKey: options.appKey,
        version: options.version || '0.0.1',
        env,
        deleteLocalSourceMap: options.deleteLocalSourceMap || (env === 'production'),
    };

    return {
        name: 'vite-webeye-sourcemap-upload-plugin',
        enforce: 'post',
        apply: 'build',
        closeBundle: {
            sequential: true,
            async handler() {
                try {
                    await uploadSourceMap(config);
                } catch (error) {
                    console.error('Source map upload failed: ', error);
                }
            }
        }
    }
}

async function uploadSourceMap(config: SourcemapUploadPluginOptions) {
    // 查找输出目录中的所有 .map 文件
    const distPath = path.resolve(process.cwd(), 'dist');
    const mapFiles = glob.sync('**/*.map', {cwd: distPath});

    if (mapFiles.length === 0) {
        console.log('No Source map files found');
        return;
    }

    console.log(`Found ${mapFiles.length} source map files, uploading...`);

    // 批量上传
    for (const mapFile of mapFiles) {
        const filePath = path.join(distPath, mapFile);
        const content = fs.readFileSync(filePath);

        await uploadFile({
            filename: mapFile,
            content,
            filePath
        }, config);

         // 删除本地 map 文件
        if (config.deleteLocalSourceMap) {
            fs.unlinkSync(filePath);
            console.log(`Deleted local source map file: ${filePath}`);
        }
    }

    console.log(`Source map upload completed`);
}

interface FileFace {
    filename: string;
    content: Buffer;
    filePath: string;
}

async function uploadFile(file: FileFace, config: SourcemapUploadPluginOptions) {
    const formData = new FormData();
    formData.append('file', file.content, file.filename);
    formData.append('version', config.version);
    formData.append('env', config.env);

    try {
        const response = await axios.post(config.uploadUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'AuthAppKey': `Bearer_${config.appKey}`,
            }
        });

        console.log(`Uploaded: ${file.filename} - ${response.data.message}`);
    } catch (error) {
        console.error(`Failed to upload ${file.filename}:`, (error as Error).message);
        throw error;
    }
}