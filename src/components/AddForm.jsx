import { useState } from 'react'
import StarInput from './StarInput'

const EMPTY = { title: '', creator: '', year: '', status: 'bekliyor', note: '', start_date: '', end_date: '', rating: null }

export default function AddForm({ creatorLabel, disabled, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.title.trim() || disabled) return
    setSubmitting(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        creator: form.creator.trim() || null,
        year: form.year.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
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

  return (
    <div className="add-form" style={{ opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' }} onKeyDown={handleKeyDown}>
      <div className="add-form-label">Yeni Ekle</div>
      <div className="form-row">
        <input type="text" name="title" placeholder="Başlık *" autoComplete="off" value={form.title} onChange={(e) => set('title', e.target.value)} />
        <input type="text" name="creator" placeholder={creatorLabel} autoComplete="off" value={form.creator} onChange={(e) => set('creator', e.target.value)} />
        <input type="text" name="year" placeholder="Yıl" autoComplete="off" value={form.year} onChange={(e) => set('year', e.target.value)} />
      </div>
      <div className="form-row">
        <select name="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="bekliyor">⏳ Listede Bekliyor</option>
          <option value="devam">▶️ Devam Ediyor</option>
          <option value="bitti">✅ Tamamlandı</option>
        </select>
        <input type="text" name="note" placeholder="Not (isteğe bağlı)" autoComplete="off" value={form.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      <div className="form-row">
        <span className="form-date-label">📅 Başlangıç:</span>
        <input type="date" name="start_date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        <span className="form-date-label">🏁 Bitiş:</span>
        <input type="date" name="end_date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
      </div>
      <div className="star-row">
        <span className="star-row-label">⭐ Puan (10 üzerinden):</span>
        <StarInput name="add_rating" value={form.rating} onChange={(v) => set('rating', v)} />
        <button className="btn-add" disabled={disabled || submitting} onClick={handleSubmit}>
          {submitting ? '...' : '+ Ekle'}
        </button>
      </div>
    </div>
  )
}
