import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import livereload from 'rollup-plugin-livereload';

export default {
    input: 'src/webVitals.ts',
    output: [
        {
            file: 'dist/bundle.cjs.js',
            format: 'cjs',
            sourcemap: true,
        },
        {
            file: 'dist/bundle.esm.js',
            format: 'esm',
            sourcemap: true,
        },
        {
            file: 'dist/bundle.umd.js',
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
        terser(),
        livereload({
            watch: 'dist',
        }),
    ],
};
