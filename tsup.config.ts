import { defineConfig } from 'tsup'
import * as esbuild from 'esbuild';
import * as path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

function inlineWorkerPlugin(): esbuild.Plugin {
    return {
        name: 'inline-worker',
        setup(build) {
            build.onResolve({ filter: /\.inline$/ }, (args) => {
                // 把 .inline 转成 .ts
                const resolved = path.resolve(path.dirname(args.importer), args.path.replace(/\.inline$/, '.ts'));
                return { path: resolved, namespace: 'inline-worker-ns' };
            });

            build.onLoad({ filter: /.*/, namespace: 'inline-worker-ns' }, async (args) => {
                const result = await esbuild.build({
                    entryPoints: [args.path],
                    bundle: true,
                    write: false,
                    format: 'iife',
                    target: 'es2020'
                });
                const code = result.outputFiles[0].text;
                return { contents: `export default ${JSON.stringify(code)};`, loader: 'js' };
            });
        }
    };
}

const isPro = process.env.NODE_ENV !== 'development';

export default defineConfig({
    platform: 'browser',
    entry: ['src/index.ts'],
    format: ['esm', 'cjs', 'iife'], // 关键：三种格式
    globalName: 'WebEyeLogs',    // IIFE 暴露为 window.WebMonitorSDK
    dts: true,                      // ESM 用户可获得类型支持
    outDir: `dist/v${pkg.version}`,
    minify: true,
    clean: true,
    target: 'es2017',
    sourcemap: true,
    esbuildOptions: (options) => {
        options.minify = true;

        if (isPro) {
            // options.drop = ['console', 'debugger']
        }

        return options;
    },
    esbuildPlugins: [inlineWorkerPlugin()],
})
