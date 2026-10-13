import { useEffect, useState } from 'react'
import StarInput from './StarInput'
import DateField from './DateField'
import MovieSearch from './MovieSearch'
import BulkImport from './BulkImport'
import { datesFromForm, itemYearError, localToday, parseDate } from '../utils/itemDates'
import { supabase } from '../lib/supabaseClient'
import { normalizeItemTitle } from '../utils/itemIdentity'

const EMPTY = { title: '', creator: '', year: '', status: 'bekliyor', note: '', start_date: '', end_date: '', rating: null }

export default function AddForm({ category, creatorLabel, disabled, onSubmit, existingItems = [], onImport }) {
  const [dateError, setDateError] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [movieLoading, setMovieLoading] = useState(false)
  const [searchVersion, setSearchVersion] = useState(0)
  const [sourceId, setSourceId] = useState(null)
  const [usage, setUsage] = useState(null)
  const [usageVersion, setUsageVersion] = useState(0)
  useEffect(() => {
    let active = true
    supabase.rpc('get_item_creation_status').then(({ data, error }) => { if (active) setUsage(error ? null : data) })
    return () => { active = false }
  }, [usageVersion])
  const similar = form.title.trim() && existingItems.some((item) => normalizeItemTitle(item.title) === normalizeItemTitle(form.title))

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const yearError = itemYearError(form.year)

  async function handleSubmit() {
    if (!form.title.trim() || disabled || submitting || movieLoading) return
    if (itemYearError(form.year)) return
    let dates
    try { dates = datesFromForm(form); setDateError('') }
    catch (error) { setDateError(error.message); return }
    setSubmitting(true)
    try {
      const saved = await onSubmit({
        title: form.title.trim(),
        creator: form.creator.trim() || null,
        year: form.year.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
        ...dates,
        rating: form.rating,
        ...(sourceId != null ? { source_id: sourceId } : {}),
      })
      if (saved === false) return
      setForm(EMPTY)
      setSourceId(null)
      setSearchVersion((value) => value + 1)
    } catch (error) {
      setDateError(error.message || 'İçerik eklenemedi. Tekrar dene.')
    } finally {
      setSubmitting(false)
      setUsageVersion((value) => value + 1)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.defaultPrevented) {
      e.preventDefault()
      handleSubmit()
    }
  }

  let minimumEnd
  try { minimumEnd = parseDate(form.start_date) } catch { /* Incomplete start date. */ }

  return (
    <div className="add-form" style={{ opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' }} onKeyDown={handleKeyDown}>
      {(category === 'film' || category === 'dizi') && <MovieSearch key={`${category}-${searchVersion}`} category={category} disabled={disabled || submitting} onManual={() => setSourceId(null)} onPendingChange={setMovieLoading} onSelect={(movie) => {
        setSourceId(movie.id)
        setForm((current) => ({ ...current, title: movie.title, creator: movie.creator, year: movie.year }))
      }} />}
      <div className="form-row">
        <input type="text" name="title" placeholder="Başlık *" maxLength={300} readOnly={sourceId != null} autoComplete="off" value={form.title} onChange={(e) => set('title', e.target.value)} />
        <input type="text" name="creator" placeholder={creatorLabel} maxLength={300} readOnly={sourceId != null} autoComplete="off" value={form.creator} onChange={(e) => set('creator', e.target.value)} />
        <input type="text" name="year" readOnly={sourceId != null} aria-label="Yıl" aria-invalid={Boolean(yearError)} aria-describedby={yearError ? 'add-year-error' : undefined} placeholder="Yıl" inputMode="numeric" maxLength={4} autoComplete="off" value={form.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))} />
      </div>
      <div className="form-row">
        <select name="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="bekliyor">⏳ Listede Bekliyor</option>
          <option value="devam">▶️ Devam Ediyor</option>
          <option value="bitti">✅ Tamamlandı</option>
        </select>
        <input type="text" name="note" placeholder="Not (isteğe bağlı)" maxLength={3000} autoComplete="off" value={form.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      {yearError && <div className="auth-error" role="alert" id="add-year-error">{yearError}</div>}
      <div className="form-row form-dates">
        <div className="form-date-group">
          <span className="form-date-label">📅 Başlangıç:</span>
          <DateField label="Başlangıç tarihi" value={form.start_date} onChange={(value) => set('start_date', value)} max={localToday()} />
        </div>
        <div className="form-date-group">
          <span className="form-date-label">🏁 Bitiş:</span>
          <DateField label="Bitiş tarihi" value={form.end_date} onChange={(value) => set('end_date', value)} min={minimumEnd} max={localToday()} />
        </div>
      </div>
      {dateError && <div className="auth-error" role="alert">{dateError}</div>}
      {similar && <p className="creation-hint" role="status">Bu başlık koleksiyonunda var. Aynı eserse mevcut kaydı düzenle; farklı bir eserse yıl ve yazar bilgisini kontrol et.</p>}
      {usage && <p className="creation-hint">{usage.blocked ? 'Yeni içerik eklemen kısıtlandı. Destek adresiyle iletişime geçebilirsin.' : `Bugün ${usage.used}/100 içerik ekledin. Hakların Türkiye saatiyle 00:00’da yenilenir.`}</p>}
      <div className="star-row">
        <span className="star-row-label">⭐ Puan (10 üzerinden):</span>
        <StarInput name="add_rating" value={form.rating} onChange={(v) => set('rating', v)} />
        <button className="btn-add" disabled={disabled || submitting || movieLoading || Boolean(yearError)} onClick={handleSubmit}>
          {submitting ? '...' : '+ Ekle'}
        </button>
      </div>
      {onImport && <BulkImport category={category} disabled={disabled || submitting} onImport={onImport} onComplete={() => setUsageVersion((value) => value + 1)} />}
    </div>
  )
}
