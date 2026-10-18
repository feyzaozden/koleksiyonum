import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ANNOUNCEMENTS, announcementReads } from '../constants/announcements'

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const root = useRef(null)
  const bell = useRef(null)
  const version = useRef(0)
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const [retry, setRetry] = useState(0)
  const [announcementBusy, setAnnouncementBusy] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const readAnnouncements = announcementReads(user)
  const totalUnread = unread + ANNOUNCEMENTS.filter(entry => !readAnnouncements.includes(entry.id)).length

  async function readAnnouncement(id) {
    if (announcementBusy || !user) return
    setAnnouncementBusy(true)
    setAnnouncementError('')
    try {
      const { error: failure } = await supabase.auth.updateUser({
        data: { announcement_reads: [...new Set([...readAnnouncements, id])] },
      })
      if (failure) throw failure
    } catch {
      setAnnouncementError('Okundu bilgisi kaydedilemedi. Tekrar dene.')
    } finally { setAnnouncementBusy(false) }
  }

  useEffect(() => {
    let active = true
    setEntries([]); setUnread(0); setLoading(true)
    async function refresh() {
      if (!user || document.hidden) return
      const request = ++version.current
      const { data, error: failure } = await supabase.rpc('get_reaction_notifications')
      if (!active || request !== version.current) return
      setLoading(false)
      if (failure) { setError('Bildirimler yüklenemedi.'); return }
      setError(''); setEntries(data.entries); setUnread(data.unread); setMore(data.entries.length === 30)
    }
    refresh()
    // While reading older entries, polling must not replace the list.
    const timer = open ? null : setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { active = false; version.current++; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [user, open, retry])

  useEffect(() => {
    if (!open) return
    function outside(e) { if (!root.current?.contains(e.target)) setOpen(false) }
    function escape(e) { if (e.key === 'Escape') { setOpen(false); bell.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])

  async function older() {
    setBusy(true)
    const request = ++version.current
    const { data, error: failure } = await supabase.rpc('get_reaction_notifications', { before_id: entries.at(-1).id })
    setBusy(false)
    if (request !== version.current) return
    if (failure) { setError('Bildirimler yüklenemedi.'); return }
    setEntries(prev => [...prev, ...data.entries]); setMore(data.entries.length === 30)
  }

  async function visit(entry) {
    setBusy(true)
    const request = ++version.current
    const { error: failure } = await supabase.rpc('read_reaction_notification', { notification_id: entry.id })
    setBusy(false)
    if (request !== version.current) return
    if (failure) { setError('Bildirim okundu olarak işaretlenemedi. Tekrar dene.'); return }
    setEntries(prev => prev.map(n => n.id === entry.id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
    if (!entry.read_at) setUnread(n => Math.max(0, n - 1))
    if (!entry.item_id) { setError('Bu içerik artık mevcut değil.'); return }
    setOpen(false)
    navigate(`/app?item=${entry.item_id}`, { state: { notification: entry.id, clickedAt: Date.now() } })
  }

  return <div className="notifications" ref={root}>
    <button ref={bell} type="button" className="btn-imdb-link" aria-expanded={open} aria-controls="notifications-panel" onClick={() => setOpen(v => !v)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      Bildirimlerim {totalUnread > 0 && <span className="nav-badge" aria-label={`${totalUnread} okunmamış bildirim`}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
    </button>
    {open && <section id="notifications-panel" className="notifications-panel" aria-label="Bildirimlerim">
      <strong>Bildirimlerim</strong>
      <div className="announcement-list" aria-label="Koleksiyonum’dan yenilikler">
        {ANNOUNCEMENTS.map(entry => <article className="announcement-card" key={entry.id}>
          <div className="announcement-heading"><small>Koleksiyonum’dan yenilikler</small>{!readAnnouncements.includes(entry.id) && <span className="nav-badge">Yeni</span>}</div>
          <h3>🔔 {entry.title}</h3>
          <p>{entry.text}</p>
          <time dateTime={entry.date}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
          {!readAnnouncements.includes(entry.id) && <button type="button" disabled={announcementBusy} onClick={() => readAnnouncement(entry.id)}>{announcementBusy ? 'Kaydediliyor…' : 'Okudum'}</button>}
        </article>)}
        {announcementError && <p role="alert">{announcementError}</p>}
      </div>
      {loading && <p role="status">Yükleniyor…</p>}
      {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Tekrar dene</button></p>}
      {!loading && !error && !entries.length && <p>Henüz tepki bildirimin yok.</p>}
      <ul>{entries.map(entry => <li key={entry.id}><button className={`notification-entry ${entry.read_at ? '' : 'unread'}`} disabled={busy} onClick={() => visit(entry)}>
        <span>Bir kişi <strong>{entry.title}</strong> {({ film: 'filmine', dizi: 'dizine', kitap: 'kitabına' })[entry.category] || 'içeriğine'} {entry.reaction === 1 ? 'beğeni' : 'beğenmeme'} bıraktı.</span>
        <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</time>
        {!entry.read_at && <small>Okunmadı</small>}
      </button></li>)}</ul>
      {more && <button disabled={busy} onClick={older}>Daha eski bildirimler</button>}
    </section>}
  </div>
}
