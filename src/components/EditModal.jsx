import { useEffect, useState } from 'react'
import StarInput from './StarInput'
import DateField from './DateField'
import { datesFromForm, itemYearError, localToday, parseDate, displayDate } from '../utils/itemDates'

export default function EditModal({ item, onClose, onSave }) {
  const [dateError, setDateError] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDateError('')
    if (item) {
      setForm({
        title: item.title || '',
        creator: item.creator || '',
        year: item.year || '',
        status: item.status || 'bekliyor',
        note: item.note || '',
        start_date: displayDate(item.start_date),
        end_date: displayDate(item.end_date),
        rating: item.rating || null,
      })
    } else {
      setForm(null)
    }
  }, [item])

  if (!item || !form) return null

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const yearError = itemYearError(form.year)

  async function handleSave() {
    if (!form.title.trim()) return
    if (itemYearError(form.year)) return
    let dates
    try { dates = datesFromForm(form); setDateError('') }
    catch (error) { setDateError(error.message); return }
    setSaving(true)
    try {
      await onSave(item.id, {
        title: form.title.trim(),
        creator: form.creator.trim() || null,
        year: form.year.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
        ...dates,
        rating: form.rating,
      })
    } finally {
      setSaving(false)
    }
  }

  let minimumEnd
  try { minimumEnd = parseDate(form.start_date) } catch { /* Incomplete start date. */ }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-title">✏️ Düzenle</div>
        <div className="modal-row">
          <input type="text" placeholder="Başlık *" value={form.title} onChange={(e) => set('title', e.target.value)} />
          <input type="text" placeholder="Yazar / Yönetmen / Yapımcı" value={form.creator} onChange={(e) => set('creator', e.target.value)} />
        </div>
        <div className="modal-row">
          <input type="text" placeholder="Yıl" aria-label="Yıl" aria-invalid={Boolean(yearError)} aria-describedby={yearError ? 'edit-year-error' : undefined} inputMode="numeric" maxLength={4} style={{ flex: 0.5, minWidth: 80 }} value={form.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <select style={{ flex: 1, minWidth: 140 }} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="bekliyor">⏳ Listede Bekliyor</option>
            <option value="devam">▶️ Devam Ediyor</option>
            <option value="bitti">✅ Tamamlandı</option>
          </select>
        </div>
        <input type="text" placeholder="Not (isteğe bağlı)" value={form.note} onChange={(e) => set('note', e.target.value)} />
        {yearError && <div className="auth-error" role="alert" id="edit-year-error">{yearError}</div>}
        <div className="modal-date-row">
          <div className="modal-date-group">
            <label>📅 Başlangıç Tarihi</label>
            <DateField label="Başlangıç tarihi" value={form.start_date} onChange={(value) => set('start_date', value)} max={localToday()} />
          </div>
          <div className="modal-date-group">
            <label>🏁 Bitiş Tarihi</label>
            <DateField label="Bitiş tarihi" value={form.end_date} onChange={(value) => set('end_date', value)} min={minimumEnd} />
          </div>
        </div>
        {dateError && <div className="auth-error" role="alert">{dateError}</div>}
        <div className="modal-star-row">
          <div className="modal-star-label">⭐ Puan (10 üzerinden)</div>
          <StarInput name="edit_rating" value={form.rating} onChange={(v) => set('rating', v)} className="modal-star-input" />
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>İptal</button>
          <button className="btn-save" disabled={saving || Boolean(yearError)} onClick={handleSave}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}
