import { useEffect, useRef, useState } from 'react'

export default function FavoritesPicker({ items, onChange, onClose }) {
  const dialog = useRef(null), pending = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [search, setSearch] = useState('')
  useEffect(() => {
    const el = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    el.showModal(); document.body.style.overflow = 'hidden'
    return () => { el.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  async function toggle(item) {
    if (pending.current) return
    if (!item.featured_at && items.filter(i => i.featured_at).length >= 4) { setError('En fazla 4 favori seçebilirsin. Önce birini kaldır.'); return }
    pending.current = true; setBusy(true); setError('')
    try { await onChange(item.id, !item.featured_at) }
    catch (err) { setError(err.message) }
    finally { pending.current = false; setBusy(false) }
  }
  const results = items.filter(i => `${i.title} ${i.creator || ''}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))
  return <dialog ref={dialog} className="add-item-dialog music-editor" aria-label="Favorileri düzenle" onCancel={e => { e.preventDefault(); if (!pending.current) onClose() }}>
    <div className="add-item-dialog-heading"><h2>Favorileri düzenle</h2><button disabled={busy} onClick={onClose} aria-label="Kapat">×</button></div>
    <p>{items.filter(i => i.featured_at).length}/4 favori</p>
    {items.filter(i => i.featured_at).length > 4 && <p>Önceki seçimlerin korunuyor. Profilinde ilk 4 seçim görünür; burada kaldırarak hangi dört içeriğin kalacağını belirleyebilirsin.</p>}
    <div className="music-search-bar"><input type="search" aria-label="Favori eklemek için ara" placeholder="Koleksiyonunda ara…" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="playlist-song-picker">{results.map(item => <label key={item.id}><input type="checkbox" checked={!!item.featured_at} disabled={busy} onChange={() => toggle(item)} /><span>{item.title}<small>{item.creator}</small></span></label>)}</div>
    {!results.length && <p>{items.length ? 'Aramana uygun içerik bulunamadı.' : 'Önce koleksiyonuna bir içerik ekle.'}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="music-editor-footer"><button className="btn-save" disabled={busy} onClick={onClose}>Tamam</button></div>
  </dialog>
}
