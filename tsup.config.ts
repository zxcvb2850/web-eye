import { defineConfig } from 'tsup'
import { readFileSync } from 'fs';

// 从 package.json 读取信息
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const isPro = process.env.NODE_ENV !== 'development';

export default defineConfig({
  platform: 'browser',
  entry: ['src/index.ts'],
  // 打包三种格式
  format: ['esm', 'cjs', 'iife'],
  // 生成类型声明文件
  dts: true,
  // 固定输出目录为 dist
  outDir: `dist/v${pkg.version}`,
  // outDir: `dist`,
  minify: true,
  clean: true,
  target: 'es2017',
  sourcemap: true,
  esbuildOptions: (options) => {
    options.minify = true

    if (isPro) {
      // 在生产构建中可以考虑移除 console 和 debugger
      // options.drop = ['console', 'debugger']
    }

    return options
  },
})
