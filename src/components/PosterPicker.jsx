import { useEffect, useRef, useState } from 'react'
import MovieSearch from './MovieSearch'
import { supabase } from '../lib/supabaseClient'

export default function PosterPicker({ item, onSaved, onClose }) {
  const dialog = useRef(null)
  const lock = useRef(false)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current.showModal() }, [])
  async function save() {
    if (lock.current || !selected?.poster_path) return
    lock.current = true; setBusy(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Tekrar giriş yapmalısın.')
      const response = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ item_id: item.id, category: item.category, source_id: selected.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Afiş kaydedilemedi.')
      onSaved(data.item)
    } catch (e) { setError(e.message || 'Afiş kaydedilemedi.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="delete-dialog poster-dialog" aria-labelledby="poster-heading" onCancel={e => { e.preventDefault(); if (!lock.current) onClose() }}>
    <h2 id="poster-heading">Afiş seç</h2><p>{item.title}</p>
    <MovieSearch category={item.category} initialQuery={item.title} posterMode disabled={busy} onSelect={value => { setSelected(value); setError('') }} />
    {selected && <div className="poster-selection"><strong>{selected.title} {selected.year && `(${selected.year})`}</strong>
      {selected.poster ? <img src={selected.poster} alt="Seçilen afiş" width="92" height="138" /> : <p>Bu yapımın afişi bulunmuyor.</p>}
      <p>Yalnızca afiş ve TMDB eşleştirmesi kaydedilir. Diğer bilgilerin korunur.</p>
    </div>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    <div className="modal-actions"><button disabled={busy} onClick={onClose}>Vazgeç</button><button disabled={busy || !selected?.poster_path} onClick={save}>{busy ? 'Kaydediliyor…' : 'Afişi kaydet'}</button></div>
  </dialog>
}
