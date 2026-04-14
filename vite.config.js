import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },
  server: {
    port: 8080,
    proxy: {
      '/api/fund-search': {
        target: 'https://fundsuggest.eastmoney.com',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/fund-search/, '/FundSearch/api/FundSearchAPI.ashx'),
      },
      '/api/fund-history': {
        target: 'https://api.fund.eastmoney.com',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/fund-history/, '/f10/lsjz'),
        headers: {
          Referer: 'https://fundf10.eastmoney.com/',
        },
      },
      '/api/fund-realtime': {
        target: 'https://fundgz.1234567.com.cn',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/fund-realtime/, '/js'),
      },

    },
  }
})
