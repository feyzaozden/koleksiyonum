import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useAnnouncements } from '../hooks/useAnnouncements'

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
  const [tab, setTab] = useState('notifications')
  const announcements = useAnnouncements()
  const totalUnread = unread + announcements.unread
  const actionLock = useRef(false)

  useEffect(() => {
    let active = true
    setEntries([]); setUnread(0); setLoading(true)
    async function refresh() {
      if (!user || document.hidden || actionLock.current) return
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

  async function markRead(entry) {
    if (actionLock.current) return false
    if (entry.read_at) return true
    actionLock.current = true
    setBusy(true)
    const request = ++version.current
    try {
    const { error: failure } = await supabase.rpc('read_reaction_notification', { notification_id: entry.id })
    if (request !== version.current) return false
    if (failure) { setError('Bildirim okundu olarak işaretlenemedi. Tekrar dene.'); return false }
    setError('')
    setEntries(prev => prev.map(n => n.id === entry.id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
    if (!entry.read_at) setUnread(n => Math.max(0, n - 1))
    return true
    } catch {
      if (request === version.current) setError('Bildirim okundu olarak işaretlenemedi. Tekrar dene.')
      return false
    } finally { setBusy(false); actionLock.current = false }
  }

  async function visit(entry) {
    if (!await markRead(entry)) return
    if (entry.kind === 'friend') {
      if (!entry.profile_id) { setError('Bu hesap artık mevcut değil.'); return }
      setOpen(false)
      navigate(`/people/${entry.profile_id}`)
      return
    }
    if (!entry.item_id) { setError('Bu içerik artık mevcut değil.'); return }
    setOpen(false)
    if (entry.kind === 'comment' || entry.kind === 'reply') {
      navigate(`/items/${entry.item_id}/comments${entry.comment_id ? `?comment=${entry.comment_id}` : ''}`)
      return
    }
    navigate(`/app?item=${entry.item_id}`, { state: { notification: entry.id, clickedAt: Date.now() } })
  }

  return <div className="notifications" ref={root}>
    <button ref={bell} type="button" className="btn-imdb-link" aria-expanded={open} aria-controls="notifications-panel" onClick={() => { if (!open) { setTab('notifications'); announcements.refresh() } setOpen(v => !v) }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      Bildirimlerim {totalUnread > 0 && <span className="nav-badge" aria-label={`${totalUnread} okunmamış bildirim`}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
    </button>
    {open && <section id="notifications-panel" className="notifications-panel" aria-label="Bildirimlerim">
      <strong>Bildirimlerim</strong>
      <div className="notification-tabs" role="group" aria-label="Bildirim türü">
        <button type="button" aria-pressed={tab === 'notifications'} onClick={() => setTab('notifications')}>Bildirimler{unread > 0 ? ` · ${unread}` : ''}</button>
        <button type="button" aria-pressed={tab === 'news'} onClick={() => setTab('news')}>Yenilikler{announcements.unread > 0 ? ` · ${announcements.unread}` : ''}</button>
      </div>
      {tab === 'news' && <div className="announcement-list" aria-label="Koleksiyonum’dan yenilikler">
        {announcements.loading && <p role="status">Yükleniyor…</p>}
        {!announcements.loading && !announcements.error && !announcements.entries.length && <p>Henüz duyuru yok.</p>}
        {announcements.entries.map(entry => <article className="announcement-card" key={entry.id}>
          <div className="announcement-heading"><small>Koleksiyonum’dan yenilikler</small>{!entry.read_at && <span className="nav-badge">Yeni</span>}</div>
          <h3>{entry.icon || '🔔'} {entry.title}</h3>
          <p>{entry.text}</p>
          <time dateTime={entry.published_at}>{new Date(entry.published_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
          {!entry.read_at && <button type="button" disabled={announcements.busy} onClick={() => announcements.markRead(entry)}>Okudum</button>}
        </article>)}
        {announcements.error && <p role="alert">{announcements.error} <button onClick={() => announcements.refresh()}>Tekrar dene</button></p>}
        {announcements.more && <button onClick={() => announcements.refresh(true)}>Daha eski duyurular</button>}
      </div>}
      {tab === 'notifications' && <>
      {loading && <p role="status">Yükleniyor…</p>}
      {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Tekrar dene</button></p>}
      {!loading && !error && !entries.length && <p>Henüz kişisel bildirimin yok.</p>}
      <ul>{entries.map(entry => <li className={`notification-row ${entry.read_at ? '' : 'unread'}`} key={entry.id}><button className="notification-entry" disabled={busy} onClick={() => visit(entry)}>
        {entry.kind === 'friend'
          ? <span><strong>{entry.username ? `@${entry.username}` : 'Bir kullanıcı'}</strong> seni arkadaş ekledi.</span>
          : entry.kind === 'comment' || entry.kind === 'reply'
          ? <span><strong>{entry.username ? `@${entry.username}` : 'Bir kişi'}</strong> {entry.kind === 'reply' ? 'yorumuna cevap verdi' : `“${entry.title}” içeriğine yorum yaptı`}.</span>
          : <span>Bir kişi <strong>{entry.title}</strong> {({ film: 'filmine', dizi: 'dizine', kitap: 'kitabına', muzik: 'şarkına' })[entry.category] || 'içeriğine'} {entry.reaction === 1 ? 'beğeni' : 'beğenmeme'} bıraktı.</span>}
        <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</time>
        {!entry.read_at && <small>Okunmadı</small>}
      </button><label className="notification-read"><input type="checkbox" checked={Boolean(entry.read_at)} disabled={busy || Boolean(entry.read_at)} onChange={() => markRead(entry)} /> Okundu</label></li>)}</ul>
      {more && <button disabled={busy} onClick={older}>Daha eski bildirimler</button>}
      </>}
    </section>}
  </div>
}
