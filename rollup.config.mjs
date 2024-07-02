import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import wasm from '@rollup/plugin-wasm';
import livereload from 'rollup-plugin-livereload';
import packageJson from "./package.json";

export default {
    input: 'src/index.ts',
    output: [
        {
            file: `dist/${packageJson.name}.cjs.js`,
            format: 'cjs',
            sourcemap: true,
        },
        {
            file: `dist/${packageJson.name}.esm.js`,
            format: 'esm',
            sourcemap: true,
        },
        {
            file: `dist/${packageJson.name}.umd.js`,
            format: 'umd',
            sourcemap: true,
        },
    ],
    plugins: [
        resolve(),
        commonjs(),
        wasm(),
        typescript({ tsconfig: './tsconfig.json' }),
        json(),
        terser(),
        livereload({
            watch: 'dist',
        }),
    ],
};
