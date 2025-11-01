import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, '../../public'),
  server: {
    port: 3000,
    fs: {
      // Allow importing assets from the monorepo root (e.g., public/reference/, public/logos/)
      allow: [path.resolve(__dirname, '../../..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~root': path.resolve(__dirname, '../../..'),
      '@munlink/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@munlink/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
    },
  },
})

