import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useAnnouncements } from '../hooks/useAnnouncements'
import AdminPrivacy from './AdminPrivacy'

export default function AdminAnnouncements() {
  const { user } = useAuth()
  const userId = user?.id
  const [permission, setPermission] = useState(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let active = true
    setPermission(null)
    supabase.rpc('is_app_admin').then(({ data, error }) => { if (active) setPermission({ userId, allowed: !error && data === true }) })
    return () => { active = false }
  }, [userId])
  if (!permission?.allowed || permission.userId !== userId) return null
  return <section className="profile-password" aria-label="Admin">
    <button className="password-toggle" type="button" aria-expanded={expanded} aria-controls="admin-sections" onClick={() => setExpanded(v => !v)}>
      <span>Admin</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <div id="admin-sections" key={userId}><AdminPrivacy /><AnnouncementsPanel /></div>}
  </section>
}

function AnnouncementsPanel() {
  const [open, setOpen] = useState(false)
  return <section className="profile-password">
    <button className="password-toggle" type="button" aria-expanded={open} aria-controls="admin-announcements-panel" onClick={() => setOpen(value => !value)}>
      <span>Duyurular</span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <div id="admin-announcements-panel" hidden={!open}>{open && <AnnouncementManager />}</div>
  </section>
}

function AnnouncementManager() {
  const announcements = useAnnouncements()
  const [draft, setDraft] = useState(null)
  const [preview, setPreview] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const locked = useRef(false)
  function edit(entry) {
    setDraft(entry ? { ...entry } : { id: null, title: '', text: '', icon: '🔔' })
    setPreview(false); setError(''); setSuccess(''); setDeleting(null)
  }
  function field(key, value) { setDraft(d => ({ ...d, [key]: value })); setPreview(false) }
  const valid = draft?.title.trim() && draft?.text.trim() && Array.from(draft.title.trim()).length <= 200 && Array.from(draft.text.trim()).length <= 10000 && Array.from(draft.icon).length <= 16
  async function perform(action, message) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const { error: failure } = await action()
      if (failure) throw failure
      setDraft(null); setPreview(false); setDeleting(null); setSuccess(message)
      window.dispatchEvent(new Event('announcements-changed'))
    } catch (err) { setError(err.message || 'İşlem tamamlanamadı. Tekrar dene.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <div id="admin-announcements" className="admin-announcements">
    <h3>Duyurular</h3>
    {!draft && <button type="button" disabled={busy} onClick={() => edit(null)}>+ Duyuru paylaş</button>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    {success && <p role="status">{success}</p>}
    {draft && <form className="auth-form" onSubmit={e => { e.preventDefault(); if (valid) setPreview(true) }}>
      <div className="auth-field"><label htmlFor="announcement-title">Başlık</label><input id="announcement-title" required maxLength={200} value={draft.title} disabled={busy} onChange={e => field('title', e.target.value)} /></div>
      <div className="auth-field"><label htmlFor="announcement-text">Metin</label><textarea id="announcement-text" required maxLength={10000} rows={5} value={draft.text} disabled={busy} onChange={e => field('text', e.target.value)} /></div>
      <div className="auth-field"><label htmlFor="announcement-icon">Simge (isteğe bağlı)</label><input id="announcement-icon" maxLength={16} value={draft.icon} disabled={busy} onChange={e => field('icon', e.target.value)} /></div>
      <div className="comment-actions"><button type="submit" disabled={busy || !valid}>Önizle</button><button type="button" disabled={busy} onClick={() => { setDraft(null); setPreview(false) }}>Vazgeç</button></div>
      {preview && <div className="announcement-card"><small>Önizleme</small><h3>{draft.icon || '🔔'} {draft.title}</h3><p>{draft.text}</p>
        <button type="button" disabled={busy || !valid} onClick={() => perform(() => supabase.rpc('save_announcement', {
          announcement_id: draft.id, heading: draft.title, content: draft.text, symbol: draft.icon, expected_updated_at: draft.updated_at || null,
        }), draft.id ? 'Duyuru güncellendi.' : 'Duyuru yayımlandı.')}>{busy ? 'Kaydediliyor…' : draft.id ? 'Değişiklikleri yayımla' : 'Yayımla'}</button>
      </div>}
    </form>}
    {announcements.loading && <p role="status">Duyurular yükleniyor…</p>}
    {announcements.error && <p role="alert">{announcements.error} <button onClick={() => announcements.refresh()}>Tekrar dene</button></p>}
    {!announcements.loading && !announcements.error && !announcements.entries.length && <p>Henüz duyuru yok.</p>}
    {announcements.entries.map(entry => <article className="announcement-card" key={entry.id}>
      <h4>{entry.icon} {entry.title}</h4><time dateTime={entry.published_at}>{new Date(entry.published_at).toLocaleDateString('tr-TR')}</time>
      {deleting?.id === entry.id ? <div className="announcement-delete-confirm" role="group" aria-label="Duyuru silme onayı">
        <p>Bu duyuru tüm kullanıcıların Yenilikler listesinden kaldırılacak. Silinsin mi?</p>
        <button disabled={busy} onClick={() => perform(() => supabase.rpc('delete_announcement', { announcement_id: deleting.id, expected_updated_at: deleting.updated_at }), 'Duyuru silindi.')}>Evet, sil</button>
        <button disabled={busy} onClick={() => setDeleting(null)}>Vazgeç</button>
      </div> : <div className="comment-actions"><button disabled={busy || Boolean(draft)} onClick={() => edit(entry)}>Düzenle</button><button disabled={busy || Boolean(draft)} onClick={() => { setDeleting(entry); setError(''); setSuccess('') }}>Sil</button></div>}
    </article>)}
    {announcements.more && <button disabled={busy} onClick={() => announcements.refresh(true)}>Daha fazla duyuru</button>}
  </div>
}
