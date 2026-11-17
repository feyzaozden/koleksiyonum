import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMovieHandler, createSeriesHandler } from './movies.js'
import { createMusicHandler } from './music.js'
import { createVerifiedItemHandler } from './createItem.js'

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' }
export function createApp({ dist = resolve('dist'), env = process.env, handlers } = {}) {
  const root = resolve(dist)
  const routes = handlers || {
    '/api/movies': createMovieHandler({ env }), '/api/series': createSeriesHandler({ env }),
    '/api/music': createMusicHandler({ env }), '/api/items': createVerifiedItemHandler({ env }),
  }
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      if (pathname === '/healthz') { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end('{"ok":true}'); return }
      if (Object.hasOwn(routes, pathname)) { await routes[pathname](req, res); return }
      if (pathname === '/api' || pathname.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"Not found"}'); return }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return }
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); res.end(); return }
      let file = resolve(root, '.' + pathname)
      if (!file.startsWith(root + sep) && file !== root) { res.writeHead(404); res.end(); return }
      const info = await stat(file).catch(() => null)
      if (!info?.isFile()) {
        if (extname(pathname) || pathname.startsWith('/assets/')) { res.writeHead(404); res.end(); return }
        file = resolve(root, 'index.html')
      }
      const body = await readFile(file)
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
      res.setHeader('Cache-Control', file.startsWith(resolve(root, 'assets') + sep) ? 'public, max-age=31536000, immutable' : 'no-cache')
      res.setHeader('Content-Length', body.length)
      res.end(req.method === 'HEAD' ? undefined : body)
    } catch {
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"Request failed"}') }
      else res.destroy()
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp()
  app.requestTimeout = 30000
  app.headersTimeout = 15000
  app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Koleksiyonum server ready'))
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    app.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10000).unref()
  })
}
