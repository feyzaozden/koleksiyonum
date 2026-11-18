import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/collection-app/',
  build: { outDir: 'backend/pages/collection-ui', rollupOptions: { input: 'collection-app.html' } },
})
