import { defineConfig } from 'tsup'

const isPro = process.env.NODE_ENV !== 'development';

export default defineConfig({
    platform: 'browser',
    entry: {
        index: 'src/index.ts',
        worker: 'src/workers/logWorker.ts',
    },
    format: ['esm', 'cjs', 'iife'], // 关键：三种格式
    globalName: 'WebEyeLogs',    // IIFE 暴露为 window.WebMonitorSDK
    dts: true,                      // ESM 用户可获得类型支持
    outDir: 'dist',
    minify: true,
    clean: true,
    target: 'es2017',
    sourcemap: true,
    esbuildOptions: (options) => {
        if (isPro) {
            options.drop = ['console', 'debugger']
        }

        return options;
    }
})
