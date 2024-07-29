import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import wasm from '@rollup/plugin-wasm';
import livereload from 'rollup-plugin-livereload';

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
        wasm(),
        typescript({ tsconfig: './tsconfig.json' }),
        json(),
        terser({
            compress: {
                drop_console: process.env.NODE_ENV === 'production',
                drop_debugger: process.env.NODE_ENV === 'production',
            }
        }),
        livereload({
            watch: 'dist',
        }),
    ],
};
