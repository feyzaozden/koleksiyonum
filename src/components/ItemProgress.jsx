import { useEffect, useRef, useState } from 'react'
import { progressError, progressPatch, progressText } from '../utils/progress'
import { datesFromForm, displayDate, localToday } from '../utils/itemDates'
import DateField from './DateField'

function ProgressDialog({ item, finish, onClose, onSave }) {
  const dialog = useRef(null)
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(() => structuredClone(item.progress || {}))
  const [endDate, setEndDate] = useState(displayDate(localToday()))
  const isSeries = item.category === 'dizi'
  const validation = progressError(draft, item.category)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  function number(key, label, optional = false) {
    return <label className="progress-field">{label}{optional ? ' (isteğe bağlı)' : ''}
      <input type="text" inputMode="numeric" maxLength={7} value={draft[key] ?? ''} disabled={busy}
        onChange={(event) => { if (/^\d*$/.test(event.target.value)) setDraft({ ...draft, [key]: event.target.value === '' ? null : Number(event.target.value) }) }} />
    </label>
  }
  async function save(event) {
    event.preventDefault()
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      let patch = progressPatch(item, draft)
      if (finish) {
        if (!endDate) throw new Error('Bitiş tarihini gir.')
        const dates = datesFromForm({ start_date: displayDate(item.start_date), end_date: endDate })
        patch = { ...patch, status: 'bitti', end_date: dates.end_date, progress: !isSeries && draft.total ? { ...draft, position: draft.total } : draft }
      }
      await onSave(item.id, patch)
      onClose()
    } catch (err) { setError(err.message || 'İlerleme kaydedilemedi.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <dialog className="delete-dialog progress-dialog" ref={dialog} aria-labelledby="progress-title" onCancel={(event) => { event.preventDefault(); if (!locked.current) onClose() }}>
    <form onSubmit={save}>
      <h2 id="progress-title">{finish ? 'Tamamlandı olarak işaretle' : 'İlerlemeyi güncelle'}</h2>
      <p>{item.title}</p>
      <fieldset disabled={busy}>
        {isSeries ? (!finish && <>
          <div className="progress-fields">{number('season', 'Bulunduğun sezon')}{number('position', 'Bulunduğun bölüm')}</div>
          {number('seasons', 'Toplam sezon', true)}
          <label className="progress-field">Bu sezonun toplam bölüm sayısı (isteğe bağlı)
            <input type="text" inputMode="numeric" maxLength={7} disabled={!draft.season} value={draft.episodes?.[draft.season] ?? ''}
              onChange={(event) => {
                if (!/^\d*$/.test(event.target.value)) return
                const episodes = { ...draft.episodes }
                if (event.target.value) episodes[draft.season] = Number(event.target.value)
                else delete episodes[draft.season]
                setDraft({ ...draft, episodes })
              }} />
          </label>
          <button className="btn-cancel" type="button" disabled={!draft.season || (draft.seasons != null && draft.season >= draft.seasons)}
            onClick={() => setDraft({ ...draft, season: draft.season + 1, position: 1 })}>Sonraki sezona geç</button>
        </>) : <div className="progress-fields">
          {number('position', item.category === 'kitap' ? 'Kaldığın sayfa' : 'Kaldığın dakika')}
          {number('total', item.category === 'kitap' ? 'Toplam sayfa' : 'Toplam dakika', true)}
        </div>}
        {finish && <div className="progress-field"><span>Bitiş tarihi</span><DateField label="Bitiş tarihi" value={endDate} onChange={setEndDate} min={item.start_date} /></div>}
      </fieldset>
      {(validation || error) && <p className="auth-error" role="alert">{validation || error}</p>}
      <div className="modal-actions">
        <button className="btn-cancel" type="button" disabled={busy} onClick={onClose}>Vazgeç</button>
        <button className="btn-save" disabled={busy || Boolean(validation)}>{busy ? 'Kaydediliyor…' : finish ? 'Evet, bitirdim' : 'Kaydet'}</button>
      </div>
    </form>
  </dialog>
}

export default function ItemProgress({ item, isOwner, onSave }) {
  const [mode, setMode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState(null)
  const locked = useRef(false)
  const p = item.progress || {}
  const series = item.category === 'dizi'
  const lastEpisode = p.episodes?.[p.season] != null && p.position >= p.episodes[p.season]
  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), 10000)
    return () => clearTimeout(timer)
  }, [undo])
  async function advance(revert = false) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      const patch = revert ? undo : progressPatch(item, { ...p, position: p.position + 1 })
      await onSave(item.id, patch)
      setUndo(revert ? null : { progress: p, status: item.status })
    } catch (err) { setError(err.message || 'İlerleme kaydedilemedi.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <div className="item-progress">
    {p.position != null && <p>{progressText(item)}</p>}
    {!series && p.position != null && p.total > 0 && <progress value={p.position} max={p.total} aria-label={`${item.title} ilerlemesi`} />}
    {isOwner && item.status !== 'bitti' && <div className="progress-actions">
      <button type="button" disabled={busy} onClick={() => { setUndo(null); setMode('edit') }}>İlerlemeyi güncelle</button>
      {item.status !== 'bitti' && <>
        {series && p.position != null && !lastEpisode && <button type="button" disabled={busy} onClick={() => advance()}>Bölümü bitirdim</button>}
        {series && lastEpisode && !(p.seasons && p.season >= p.seasons) && <button type="button" disabled={busy} onClick={() => { setUndo(null); setMode('edit') }}>Sonraki sezona geç</button>}
        <button type="button" disabled={busy} onClick={() => { setUndo(null); setMode('finish') }}>{series ? 'Diziyi bitirdim' : 'Bitirdim'}</button>
      </>}
      {undo && <span role="status">Bölüm güncellendi. <button type="button" disabled={busy} onClick={() => advance(true)}>Geri al</button></span>}
    </div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {mode && <ProgressDialog item={item} finish={mode === 'finish'} onClose={() => setMode(null)} onSave={onSave} />}
  </div>
}
