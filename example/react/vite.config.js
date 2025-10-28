import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {ViteSourcemapUploadPlugin} from "../../src/package/vite-sourcemap-upload-plugin.js";

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
      react(),
    ViteSourcemapUploadPlugin({
        uploadUrl: 'http://localhost:8989/a/r/s',
        appKey: '687642d809def077bf27d8c9',
    }),
  ],
})
