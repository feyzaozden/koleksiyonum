import { useEffect, useRef, useState } from 'react'
import DateField from '../components/DateField'
import StarInput from '../components/StarInput'
import CatalogSearch from './CatalogSearch'
import { request } from './client'
import { TABS } from '../constants/tabs'
import { datesFromForm, displayDate, itemYearError, localToday, parseDate } from '../utils/itemDates'

export default function ItemFormDialog({ category, item, onClose, onSave, onReload }) {
  const dialog = useRef(null)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [selecting, setSelecting] = useState(false)
  const selection = useRef(null)
  const [form, setForm] = useState(() => ({
    title: item?.title || '', creator: item?.creator || '', year: item?.year || '',
    status: item?.status || 'bekliyor', note: item?.note || '', rating: item?.rating || null,
    start_date: displayDate(item?.start_date), end_date: displayDate(item?.end_date),
  }))
  useEffect(() => {
    const element = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    element.querySelector('input')?.focus({ preventScroll: true })
    return () => { selection.current?.abort(); element.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  let minimumEnd
  const catalogLocked = Boolean(selected || item?.source === 'tmdb')
  async function choose(result) {
    selection.current?.abort()
    const controller = new AbortController(); selection.current = controller
    setSelecting(true); setError(null)
    try {
      const metadata = await request(`/api/collection/catalog?category=${category}&id=${result.id}`, controller.signal)
      if (controller.signal.aborted) return
      setSelected(metadata)
      setForm(previous => ({ ...previous, title: metadata.title, creator: metadata.creator || '', year: metadata.year || '' }))
    } catch (err) { if (!controller.signal.aborted) setError(err) }
    finally { if (!controller.signal.aborted) setSelecting(false) }
  }
  try { minimumEnd = parseDate(form.start_date) || undefined } catch { /* incomplete date */ }
  async function submit(event) {
    event.preventDefault()
    if (saving.current || selecting) return
    setError(null)
    try {
      const yearError = itemYearError(form.year)
      if (yearError) throw new Error(yearError)
      const dates = datesFromForm(form)
      const payload = { category, title: form.title.trim(), creator: form.creator.trim() || null,
        year: form.year.trim() || null, status: category === 'muzik' ? 'bekliyor' : form.status,
        note: form.note.trim() || null, rating: form.rating, ...dates }
      if (!payload.title) throw new Error('Başlık gir.')
      saving.current = true; setBusy(true)
      await onSave(payload, item, selected)
      onClose()
    } catch (err) { setError(err) }
    finally { saving.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="add-item-dialog" aria-labelledby="manual-item-title"
    onCancel={event => { event.preventDefault(); if (!saving.current) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !saving.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <div className="add-item-dialog-heading"><h2 id="manual-item-title">{TABS[category].label} {item ? 'düzenle' : 'ekle'}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Kapat">×</button></div>
    <form className="add-form" onSubmit={submit}>
      {!item && ['film','dizi'].includes(category) && !selected && <CatalogSearch category={category} onSelect={choose} disabled={busy || selecting} />}
      {selecting && <p role="status">İçerik bilgileri alınıyor…</p>}
      {selected && <p>{selected.title} seçildi. <button type="button" className="btn-cancel" disabled={busy} onClick={() => setSelected(null)}>Seçimi kaldır / elle ekle</button></p>}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-row">
          <label>Başlık<input readOnly={catalogLocked} required maxLength={300} value={form.title} onChange={e => set('title', e.target.value)} /></label>
          <label>{TABS[category].creatorLabel}<input readOnly={catalogLocked} maxLength={300} value={form.creator} onChange={e => set('creator', e.target.value)} /></label>
          <label>Yıl<input readOnly={catalogLocked} inputMode="numeric" pattern="[0-9]{1,4}" maxLength={4} value={form.year} onChange={e => set('year', e.target.value.replace(/\D/g, ''))} /></label>
        </div>
        {category !== 'muzik' && <label>Durum<select value={form.status} onChange={e => set('status', e.target.value)}>{Object.entries(TABS[category].statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <label>Not<textarea maxLength={3000} value={form.note} onChange={e => set('note', e.target.value)} /></label>
        {category !== 'muzik' && <div className="form-row"><div className="form-date-group"><span className="form-date-label">Başlangıç:</span><DateField label="Başlangıç tarihi" value={form.start_date} onChange={value => set('start_date', value)} max={localToday()} /></div><div className="form-date-group"><span className="form-date-label">Bitiş:</span><DateField label="Bitiş tarihi" value={form.end_date} onChange={value => set('end_date', value)} min={minimumEnd} max={localToday()} /></div></div>}
        <p>Puan (10 üzerinden)</p><StarInput name="manual-rating" value={form.rating} onChange={value => set('rating', value)} /><button type="button" className="btn-cancel" onClick={() => set('rating', null)}>Puanı kaldır</button>
      </fieldset>
      {error && <div role="alert" className="auth-error"><p>{error.message}</p>{error.status === 401 && <a href="/auth-test">Giriş yap</a>}{item && [404, 409].includes(error.status) && <button type="button" className="btn-cancel" onClick={onReload}>Vazgeç ve güncel listeyi yükle</button>}</div>}
      <div className="modal-actions"><button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>Vazgeç</button><button type="submit" className="btn-add" disabled={busy || selecting}>{busy ? 'Kaydediliyor…' : item ? 'Kaydet' : '+ Ekle'}</button></div>
    </form>
  </dialog>
}
