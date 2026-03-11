/* eslint-env node */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Try to get proxy from env or default to common Clash port
const proxyUrl = process.env.https_proxy || process.env.http_proxy || 'http://127.0.0.1:7890';
const agent = new HttpsProxyAgent(proxyUrl);

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/vue-i18n/') || id.includes('/@vueuse/')) {
            return 'vue-vendor'
          }

          if (id.includes('/naive-ui/')) return 'naive-ui'

          if (id.includes('/apexcharts/') || id.includes('/vue3-apexcharts/')) {
            if (id.includes('/apexcharts/')) return 'apexcharts'
            return 'vue3-apexcharts'
          }

          if (id.includes('/xlsx/') || id.includes('/docx-preview/') || id.includes('/marked/') || id.includes('/highlight.js/')) {
            return 'docs'
          }

          if (id.includes('/lucide-vue-next/') || id.includes('/v-calendar/') || id.includes('/vue-drawing-canvas/') || id.includes('/vue3-lazyload/')) {
            return 'ui-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '^/s/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/wallpaper-api': {
        target: 'https://api.codelife.cc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wallpaper-api/, ''),
      },
      '/wallhaven-api': {
        target: 'https://wallhaven.cc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wallhaven-api/, '/api/v1'),
        agent,
        secure: false,
      }
    }
  }
})
