import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { templateCompilerOptions } from '@tresjs/core'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue({
      ...templateCompilerOptions
    }),
  ],
  resolve: {
    alias: {
      'three': path.resolve(__dirname, 'node_modules/three'),
    },
  },
  server: {
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, '')
      }
    }
  }
})
