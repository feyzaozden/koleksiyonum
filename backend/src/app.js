import { createServer } from 'node:http'
import { createAuth } from './auth.js'
import { readFile } from 'node:fs/promises'
import { createItems } from './items.js'

export function createApp(pool, options = {}) {
  const auth = options.origin ? createAuth(pool, options) : null
  const items = options.origin ? createItems(pool,options) : null
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const path = new URL(req.url, 'http://localhost').pathname
    if (path === '/collection-app' || path.startsWith('/collection-app/')) {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
      const asset = path.slice('/collection-app/'.length)
      const entry = path === '/collection-app' || path === '/collection-app/'
      if (!entry && !/^assets\/[a-zA-Z0-9_-]+\.(js|css)$/.test(asset)) { res.writeHead(404); res.end(); return }
      try {
        const data = await readFile(new URL('../pages/collection-ui/' + (entry ? 'collection-app.html' : asset), import.meta.url))
        res.setHeader('Content-Type', entry ? 'text/html; charset=utf-8' : asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8')
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        res.end(req.method === 'HEAD' ? undefined : data)
      } catch { res.writeHead(404); res.end() }
      return
    }
    if(path==='/api/collection'||path.startsWith('/api/collection/')) {
      if(items)return items(req,res,path)
      res.writeHead(503);res.end('{"error":"not_configured"}');return
    }
    if(options.origin && req.method==='GET' && ['/collection-test','/collection-test.js'].includes(path)) {
      try {
        const html=path==='/collection-test'
        const contents=await readFile(new URL(html?'../pages/collection-test.html':'../pages/collection-test.js',import.meta.url))
        res.setHeader('Content-Type',html?'text/html; charset=utf-8':'text/javascript; charset=utf-8')
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        res.end(contents)
      }catch{res.writeHead(503);res.end('{"error":"page_unavailable"}')}
      return
    }
    if (options.realMail && req.method === 'GET' && ['/auth-test','/auth-test.js'].includes(path)) {
      try {
        const html = path === '/auth-test'
        const contents = await readFile(new URL(html ? '../pages/auth-test.html' : '../pages/auth-test.js',import.meta.url))
        res.setHeader('Content-Type',html ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8')
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        res.end(contents)
      } catch { res.writeHead(503); res.end('{"error":"page_unavailable"}') }
      return
    }
    if (options.allowLocalRegistration && req.method === 'GET' && ['/auth-lab','/auth-lab.js'].includes(path)) {
      try {
        const html = path === '/auth-lab'
        const contents = await readFile(new URL(html ? '../lab/index.html' : '../lab/app.js', import.meta.url))
        res.setHeader('Content-Type',html ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8')
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        res.end(contents)
      } catch { res.writeHead(503); res.end('{"error":"lab_unavailable"}') }
      return
    }
    if (path.startsWith('/auth/')) {
      if (auth) return auth(req,res,path)
      res.writeHead(503); res.end('{"error":"auth_not_configured"}'); return
    }
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end('{"error":"method_not_allowed"}'); return }
    if (path === '/health') { res.end('{"status":"ok","service":"koleksiyonum-backend"}'); return }
    if (path !== '/health/db') { res.writeHead(404); res.end('{"error":"not_found"}'); return }
    try {
      await pool.query('SELECT 1')
      res.end('{"status":"ok","database":"connected"}')
    } catch {
      res.writeHead(503); res.end('{"status":"unavailable","database":"disconnected"}')
    }
  })
}
