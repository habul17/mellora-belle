import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In production Vercel forwards these two to the API (see vercel.json).
  server: {
    proxy: {
      '/robots.txt': 'http://localhost:4000',
      '/sitemap.xml': 'http://localhost:4000',
    },
  },
})
