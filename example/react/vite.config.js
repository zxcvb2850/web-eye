import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteSourcemapUploadPlugin } from "../../src/package/vite-sourcemap-upload-plugin.js";
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module 中获取 __dirname 的方法
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
    build: {
        sourcemap: true,
    },
    plugins: [
        react(),
        ViteSourcemapUploadPlugin({
            uploadUrl: 'http://localhost:8989/a/r/s',
            appKey: '687642d8-09de-f077-bf27-d8c9',
        }),
    ]
})
