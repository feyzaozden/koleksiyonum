import { useLayoutEffect } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const visits = new Map()
export default function PageNavigation() {
  const location = useLocation()
  const type = useNavigationType()
  const { user } = useAuth()
  useLayoutEffect(() => {
    if (!user) return
    visits.set(`${user.id}:${window.history.state?.idx ?? 0}`, location.pathname)
    const entryKey = location.state?.restoreKey || location.key
    const key = `page-scroll:${user.id}:${entryKey}`
    const old = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    let target = 0
    let anchor = null
    const returning = type === 'POP' || Boolean(location.state?.restoreKey)
    try {
      target = returning ? Number(sessionStorage.getItem(key)) || 0 : 0
      anchor = returning ? JSON.parse(sessionStorage.getItem(`page-anchor:${user.id}:${entryKey}`)) : null
    } catch { /* optional storage */ }
    let restoring = true
    let lastY = target
    function restore() {
      if (!restoring) return
      const card = anchor && document.getElementById(anchor.id)
      const top = card ? window.scrollY + card.getBoundingClientRect().top - anchor.offset : target
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
    }
    function cancel() { restoring = false }
    function save() {
      if (!restoring) lastY = window.scrollY
      try { sessionStorage.setItem(key, String(lastY)) } catch { /* optional storage */ }
    }
    function onKey(e) { if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)) cancel() }
    const observer = new ResizeObserver(restore)
    observer.observe(document.body)
    restore()
    if (!returning || (target === 0 && !anchor)) restoring = false
    const timer = setTimeout(cancel, 8000)
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('pointerdown', cancel)
    window.addEventListener('keydown', onKey)
    return () => {
      // Do not read scrollY after React has removed the old list: it may already be zero.
      clearTimeout(timer); observer.disconnect()
      window.history.scrollRestoration = old
      window.removeEventListener('scroll', save); window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel); window.removeEventListener('pointerdown', cancel); window.removeEventListener('keydown', onKey)
    }
  }, [user?.id, location.key, location.pathname, location.state?.restoreKey, type])
  return null
}

export function BackButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const index = window.history.state?.idx ?? 0
  const previous = visits.get(`${user?.id}:${index - 1}`)
  const source = location.state?.returnTo
  const validSource = source?.userId === user?.id && /^\/(app|people\/[^/?]+|imdb|discover)(\?|$)/.test(source.path)
  if (!user || ['/login','/signup','/forgot-password','/reset-password','/'].includes(location.pathname)) return null
  if (location.pathname === '/app' && !previous) return null
  return <div className="page-back-bar"><button type="button" onClick={() => {
    if (validSource) {
      if (index === source.index + 1) navigate(-1)
      else navigate(source.path, { replace: true, state: { restoreKey: source.key } })
    } else if (previous) navigate(-1)
    else navigate('/app', { replace: true })
  }}><span aria-hidden="true">‹</span> Geri</button></div>
}
