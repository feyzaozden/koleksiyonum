import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export function useAnnouncements() {
  const { user } = useAuth()
  const userId = user?.id
  const [state, setState] = useState({ userId: null, entries: [], unread: 0, more: false, error: '', loading: true })
  const [busy, setBusy] = useState(false)
  const version = useRef(0)
  const page = useRef(0)
  const locked = useRef(false)
  const refresh = useCallback(async (append = false) => {
    if (!userId || locked.current) return
    const request = ++version.current
    const nextPage = append ? page.current + 1 : 0
    try {
    const { data, error } = await supabase.rpc('get_announcements', { page: nextPage })
    if (request !== version.current) return
    if (error) { setState(prev => ({ ...prev, userId, loading: false, error: 'Yenilikler yüklenemedi.' })); return }
    page.current = nextPage
    setState(prev => ({ userId, entries: append && prev.userId === userId ? [...prev.entries, ...data.entries] : data.entries,
      unread: data.unread, more: data.has_more, loading: false, error: '' }))
    } catch {
      if (request === version.current) setState(prev => ({ ...prev, userId, loading: false, error: 'Yenilikler yüklenemedi.' }))
    }
  }, [userId])
  useEffect(() => {
    const counter = version
    setState({ userId, entries: [], unread: 0, more: false, error: '', loading: true })
    refresh()
    const update = () => refresh()
    const timer = setInterval(() => { if (!document.hidden && page.current === 0) refresh() }, 30000)
    window.addEventListener('focus', update)
    window.addEventListener('announcements-changed', update)
    return () => { counter.current++; clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('announcements-changed', update) }
  }, [refresh, userId])
  async function markRead(entry) {
    if (locked.current || entry.read_at) return
    locked.current = true; setBusy(true)
    const request = ++version.current
    try {
      const { error } = await supabase.rpc('read_announcement', { announcement_id: entry.id })
      if (request !== version.current) return
      if (error) { setState(prev => ({ ...prev, error: 'Okundu bilgisi kaydedilemedi. Tekrar dene.' })); return }
      setState(prev => ({ ...prev, error: '', unread: Math.max(0, prev.unread - 1), entries: prev.entries.map(row => row.id === entry.id ? { ...row, read_at: new Date().toISOString() } : row) }))
    } catch {
      if (request === version.current) setState(prev => ({ ...prev, error: 'Okundu bilgisi kaydedilemedi. Tekrar dene.' }))
    } finally { locked.current = false; setBusy(false) }
  }
  const visible = state.userId === userId ? state : { entries: [], unread: 0, more: false, error: '', loading: true }
  return { ...visible, busy, refresh, markRead }
}
