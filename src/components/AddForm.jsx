import { useState } from 'react'
import StarInput from './StarInput'
import DateField from './DateField'
import { datesFromForm, itemYearError, localToday, parseDate } from '../utils/itemDates'

const EMPTY = { title: '', creator: '', year: '', status: 'bekliyor', note: '', start_date: '', end_date: '', rating: null }

export default function AddForm({ creatorLabel, disabled, onSubmit }) {
  const [dateError, setDateError] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const yearError = itemYearError(form.year)

  async function handleSubmit() {
    if (!form.title.trim() || disabled) return
    if (itemYearError(form.year)) return
    let dates
    try { dates = datesFromForm(form); setDateError('') }
    catch (error) { setDateError(error.message); return }
    setSubmitting(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        creator: form.creator.trim() || null,
        year: form.year.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
        ...dates,
        rating: form.rating,
      })
      setForm(EMPTY)
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  let minimumEnd
  try { minimumEnd = parseDate(form.start_date) } catch { /* Incomplete start date. */ }

  return (
    <div className="add-form" style={{ opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' }} onKeyDown={handleKeyDown}>
      <div className="add-form-label">Yeni Ekle</div>
      <div className="form-row">
        <input type="text" name="title" placeholder="Başlık *" autoComplete="off" value={form.title} onChange={(e) => set('title', e.target.value)} />
        <input type="text" name="creator" placeholder={creatorLabel} autoComplete="off" value={form.creator} onChange={(e) => set('creator', e.target.value)} />
        <input type="text" name="year" aria-label="Yıl" aria-invalid={Boolean(yearError)} aria-describedby={yearError ? 'add-year-error' : undefined} placeholder="Yıl" inputMode="numeric" maxLength={4} autoComplete="off" value={form.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))} />
      </div>
      <div className="form-row">
        <select name="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="bekliyor">⏳ Listede Bekliyor</option>
          <option value="devam">▶️ Devam Ediyor</option>
          <option value="bitti">✅ Tamamlandı</option>
        </select>
        <input type="text" name="note" placeholder="Not (isteğe bağlı)" autoComplete="off" value={form.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      {yearError && <div className="auth-error" role="alert" id="add-year-error">{yearError}</div>}
      <div className="form-row form-dates">
        <div className="form-date-group">
          <span className="form-date-label">📅 Başlangıç:</span>
          <DateField label="Başlangıç tarihi" value={form.start_date} onChange={(value) => set('start_date', value)} max={localToday()} />
        </div>
        <div className="form-date-group">
          <span className="form-date-label">🏁 Bitiş:</span>
          <DateField label="Bitiş tarihi" value={form.end_date} onChange={(value) => set('end_date', value)} min={minimumEnd} />
        </div>
      </div>
      {dateError && <div className="auth-error" role="alert">{dateError}</div>}
      <div className="star-row">
        <span className="star-row-label">⭐ Puan (10 üzerinden):</span>
        <StarInput name="add_rating" value={form.rating} onChange={(v) => set('rating', v)} />
        <button className="btn-add" disabled={disabled || submitting || Boolean(yearError)} onClick={handleSubmit}>
          {submitting ? '...' : '+ Ekle'}
        </button>
      </div>
    </div>
  )
}
