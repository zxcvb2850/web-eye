import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import livereload from 'rollup-plugin-livereload';
import { visualizer } from "rollup-plugin-visualizer";
import terser from '@rollup/plugin-terser';
import obfuscator from 'rollup-plugin-obfuscator';

export default {
    input: 'src/index.ts',
    output: [
        {
            file: 'dist/webEyeSDK.cjs.js',
            format: 'cjs',
            sourcemap: true,
        },
        {
            file: 'dist/webEyeSDK.esm.js',
            format: 'esm',
            sourcemap: true,
        },
        {
            file: 'dist/webEyeSDK.umd.js',
            format: 'umd',
            name: 'FrontendMonitoring',
            sourcemap: true,
        },
    ],
    plugins: [
        resolve(),
        commonjs(),
        typescript({ tsconfig: './tsconfig.json' }),
        json(),
        terser({
            compress: {
                drop_console: process.env.NODE_ENV === 'production',
                drop_debugger: process.env.NODE_ENV === 'production',
            }
        }),
        // 混淆代码
        obfuscator({
            // 配置选项
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            numbersToExpressions: true,
            simplify: true,
            shuffleStringArray: true,
            splitStrings: true,
            stringArrayThreshold: 0.75,
        }),
        livereload({
            watch: 'dist',
        }),
        visualizer(),
    ],
};
