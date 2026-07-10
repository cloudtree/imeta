import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spaFallbackPages } from './spaFallbackPages.js'

export default defineConfig({
  plugins: [react(), spaFallbackPages()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
