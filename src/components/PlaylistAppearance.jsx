import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { validatePhoto, PHOTO_TYPES } from '../utils/profilePhoto'

export function PlaylistCover({ path }) {
  const [image, setImage] = useState(null)
  useEffect(() => {
    let active = true, url
    setImage(null)
    if (path) supabase.storage.from('music-covers').download(path).then(({ data, error }) => {
      if (!active || error) return
      url = URL.createObjectURL(data); setImage({ path, url })
    }).catch(() => {})
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [path])
  return <span className="playlist-cover" aria-hidden="true">{image?.path === path && image ? <img src={image.url} alt="" /> : <span>♫</span>}</span>
}

export default function PlaylistAppearance({ collection, ownerId, onSave, onClose }) {
  const dialog = useRef(null)
  const [description, setDescription] = useState(collection.description || '')
  const [file, setFile] = useState(null)
  const [remove, setRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const el = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    el.showModal(); document.body.style.overflow = 'hidden'
    return () => { el.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  async function save(e) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError('')
    const bucket = supabase.storage.from('music-covers')
    let uploaded
    try {
      let path = remove ? null : collection.cover_path
      if (file) {
        validatePhoto(file)
        path = `${ownerId}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`
        const result = await bucket.upload(path, file, { contentType: file.type, upsert: false })
        if (result.error) throw new Error('Kapak yüklenemedi. Fotoğraf kurulumunu ve bağlantını kontrol et.')
        uploaded = path
      }
      await onSave({ description: description.trim(), cover_path: path })
      // Keep old files: they may be referenced by another collection or an open page.
      onClose()
    } catch (err) {
      if (uploaded) await bucket.remove([uploaded]).catch(() => {})
      setError(err.message)
    } finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="add-item-dialog playlist-appearance" onCancel={e => { e.preventDefault(); if (!busy) onClose() }} aria-label="Liste görünümünü düzenle">
    <div className="add-item-dialog-heading"><h2>{collection.name}</h2><button disabled={busy} onClick={onClose} aria-label="Kapat">×</button></div>
    <form onSubmit={save}>
      <PlaylistCover path={remove ? null : collection.cover_path} />
      <label>Kapak fotoğrafı<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const next = e.target.files?.[0]; try { validatePhoto(next); setFile(next); setRemove(false); setError('') } catch (err) { e.target.value = ''; setFile(null); setError(err.message) } }} /></label>
      <small>JPG, PNG veya WebP · En fazla 5 MB</small>
      {collection.cover_path && <label><input type="checkbox" checked={remove} disabled={busy || !!file} onChange={e => setRemove(e.target.checked)} /> Kapağı kaldır</label>}
      <label>Açıklama<textarea rows={4} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn-save" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
    </form>
  </dialog>
}
