import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { localConfigPlugin } from './dev/local-config.ts';

export default defineConfig({
  plugins: [
    localConfigPlugin(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'TNT AI Sheet',
        short_name: 'TNT Sheet',
        lang: 'zh-CN',
        description: '用自然语言与语音处理表格',
        theme_color: '#1d6b50',
        background_color: '#f7f8fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 16000000,
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: { deny: ['.env', '.env.*', '*.crt', '*.pem', '**/.git/**', '**/config.local.json'] },
  },
  optimizeDeps: { include: ['exceljs'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/jszip')) return 'excel';
          if (id.includes('node_modules/@univerjs/engine-formula')) return 'univer-formula';
        },
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
