import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createMovieHandler, createSeriesHandler } from './server/movies.js'
import { createVerifiedItemHandler } from './server/createItem.js'

export default defineConfig(({ mode }) => {
  const options = { env: { ...loadEnv(mode, process.cwd(), ''), ...process.env } }
  const handlers = { '/api/movies': createMovieHandler(options), '/api/series': createSeriesHandler(options), '/api/items': createVerifiedItemHandler(options) }
  function mount(server) {
    server.middlewares.use((req, res, next) => {
      const handler = handlers[req.url?.split('?')[0]]
      if (typeof handler === 'function') return handler(req, res)
      next()
    })
  }
  return { plugins: [react(), { name: 'local-movie-api', configureServer: mount, configurePreviewServer: mount }] }
})
