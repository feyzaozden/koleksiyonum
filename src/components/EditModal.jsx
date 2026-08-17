import { useEffect, useState } from 'react'
import StarInput from './StarInput'

export default function EditModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || '',
        creator: item.creator || '',
        year: item.year || '',
        status: item.status || 'bekliyor',
        note: item.note || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
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

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave(item.id, {
        title: form.title.trim(),
        creator: form.creator.trim() || null,
        year: form.year.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        rating: form.rating,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-title">✏️ Düzenle</div>
        <div className="modal-row">
          <input type="text" placeholder="Başlık *" value={form.title} onChange={(e) => set('title', e.target.value)} />
          <input type="text" placeholder="Yazar / Yönetmen / Yapımcı" value={form.creator} onChange={(e) => set('creator', e.target.value)} />
        </div>
        <div className="modal-row">
          <input type="text" placeholder="Yıl" style={{ flex: 0.5, minWidth: 80 }} value={form.year} onChange={(e) => set('year', e.target.value)} />
          <select style={{ flex: 1, minWidth: 140 }} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="bekliyor">⏳ Listede Bekliyor</option>
            <option value="devam">▶️ Devam Ediyor</option>
            <option value="bitti">✅ Tamamlandı</option>
          </select>
        </div>
        <input type="text" placeholder="Not (isteğe bağlı)" value={form.note} onChange={(e) => set('note', e.target.value)} />
        <div className="modal-date-row">
          <div className="modal-date-group">
            <label>📅 Başlangıç Tarihi</label>
            <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </div>
          <div className="modal-date-group">
            <label>🏁 Bitiş Tarihi</label>
            <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </div>
        </div>
        <div className="modal-star-row">
          <div className="modal-star-label">⭐ Puan (10 üzerinden)</div>
          <StarInput name="edit_rating" value={form.rating} onChange={(v) => set('rating', v)} className="modal-star-input" />
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>İptal</button>
          <button className="btn-save" disabled={saving} onClick={handleSave}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}
