import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,  // Admin 管理后台端口，避免与前端用户端 (5173) 冲突
    allowedHosts: [
      "judge-guidable-dirtiness.ngrok-free.dev"
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8888',  // 使用 IPv4 地址
        changeOrigin: true,
      },
    },
  },
})
