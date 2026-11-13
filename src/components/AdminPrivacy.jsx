import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PrivacyContent from './PrivacyContent'

export default function AdminPrivacy() {
  const [open, setOpen] = useState(false)
  return <section className="profile-password">
    <button type="button" className="password-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>Gizlilik politikasını düzenle</span><span>{open ? '−' : '+'}</span></button>
    {open && <Editor />}
  </section>
}
function Editor() {
  const [policy, setPolicy] = useState(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retry, setRetry] = useState(0)
  const locked = useRef(false)
  useEffect(() => {
    let active = true
    setError('')
    supabase.rpc('get_privacy_policy').then(({ data, error }) => {
      if (!active) return
      if (error || !data) setError('Metin yüklenemedi. Gizlilik düzenleyicisi SQL kurulumunu ve bağlantını kontrol et.')
      else setPolicy(data)
    }).catch(() => { if (active) setError('Metin yüklenemedi. Bağlantını kontrol et.') })
    return () => { active = false }
  }, [retry])
  function change(key, value) { setPolicy(p => ({ ...p, [key]: value })); setPreview(false); setSuccess('') }
  async function save() {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const { data, error } = await supabase.rpc('save_privacy_policy', { heading: policy.title, content: policy.body, expected_version: policy.version })
      if (error) throw error
      setPolicy(data); setPreview(false); setSuccess('Gizlilik politikası yayımlandı.')
    } catch { setError('Yayımlanamadı. Bağlantını ve admin yetkini kontrol et. Metin başka bir sekmede değiştiyse taslağını kopyalayıp sayfayı yenile.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <div className="admin-announcements">
    {error && <p role="alert" className="auth-error">{error} {!policy && <button onClick={() => setRetry(n => n + 1)}>Tekrar dene</button>}</p>}
    {success && <p role="status">{success}</p>}
    {!policy && !error && <p role="status">Yükleniyor…</p>}
    {policy && <form className="auth-form" onSubmit={e => { e.preventDefault(); setPreview(true) }}>
      <div className="auth-field"><label htmlFor="privacy-title">Sayfa başlığı</label><input id="privacy-title" value={policy.title} maxLength={200} required disabled={busy} onChange={e => change('title', e.target.value)} /></div>
      <div className="auth-field"><label htmlFor="privacy-body">Metin</label><textarea id="privacy-body" value={policy.body} maxLength={50000} rows={15} required disabled={busy} onChange={e => change('body', e.target.value)} /></div>
      <small>Paragrafları boş satırla ayır. Alt başlık için satırın başına ## ve bir boşluk ekle. E-posta adresleri tıklanabilir görünür.</small>
      <button type="submit" disabled={busy || !policy.title.trim() || !policy.body.trim()}>Önizle</button>
      {preview && <div className="announcement-card"><h3>{policy.title}</h3><PrivacyContent body={policy.body} /><button type="button" disabled={busy} onClick={save}>{busy ? 'Yayımlanıyor…' : 'Değişiklikleri yayımla'}</button></div>}
    </form>}
  </div>
}
