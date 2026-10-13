import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createMovieHandler } from './server/movies.js'

export default defineConfig(({ mode }) => {
  const handler = createMovieHandler({ env: { ...loadEnv(mode, process.cwd(), ''), ...process.env } })
  function mount(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === '/api/movies') return handler(req, res)
      next()
    })
  }
  return { plugins: [react(), { name: 'local-movie-api', configureServer: mount, configurePreviewServer: mount }] }
})
