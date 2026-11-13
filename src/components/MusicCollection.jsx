import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePageState } from '../hooks/usePageState'
import ItemsGrid from './ItemsGrid'
import MusicPlayer from './MusicPlayer'

function PlaylistEditor({ playlist, songs, members, onToggle, onRename, onClose }) {
  const dialog = useRef(null)
  const [name, setName] = useState(playlist.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const el = dialog.current, opener = document.activeElement
    el.showModal()
    return () => { el.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  async function run(operation) {
    if (busy) return
    setBusy(true); setError('')
    try { await operation() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <dialog className="add-item-dialog music-editor" ref={dialog} aria-label="Çalma listesini düzenle" onCancel={e => { e.preventDefault(); if (!busy) onClose() }}>
    <div className="add-item-dialog-heading"><h2>Çalma listesini düzenle</h2><button disabled={busy} onClick={onClose} aria-label="Kapat">×</button></div>
    <form className="music-search-bar" onSubmit={e => { e.preventDefault(); run(() => onRename(name.trim())) }}><input aria-label="Liste adı" maxLength={100} value={name} onChange={e => setName(e.target.value)} /><button className="btn-save" disabled={busy || !name.trim()}>Adı kaydet</button></form>
    <p>Şarkılarım’dan bu listeye eklemek istediğin şarkıları seç.</p>
    <div className="playlist-song-picker">{songs.map(song => <label key={song.id}><input type="checkbox" disabled={busy} checked={members.has(song.id)} onChange={() => run(() => onToggle(song.id))} /><span>{song.title}<small>{song.creator}</small></span></label>)}</div>
    {!songs.length && <p>Önce Şarkılarım’a bir şarkı ekle.</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="music-editor-footer"><button type="button" className="btn-save" disabled={busy} onClick={onClose}>Tamam</button></div>
  </dialog>
}

export default function MusicCollection({ ownerId, allSongs, gridProps }) {
  const isOwner = gridProps.sections[0]?.isOwner
  const [playlists, setPlaylists] = useState([])
  const [memberships, setMemberships] = useState([])
  const [selected, setSelected] = usePageState(`playlist:${ownerId}`, 'all')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [savedVideos, setSavedVideos] = useState({})
  const version = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++version.current
    setLoading(true); setError('')
    const result = await supabase.from('music_playlists').select('*').eq('user_id', ownerId).order('created_at')
    if (current !== version.current) return
    if (result.error) { setError('Çalma listeleri yüklenemedi. Müzik SQL kurulumunu kontrol et.'); setLoading(false); return }
    const ids = result.data.map(p => p.id)
    const members = ids.length ? await supabase.from('music_playlist_items').select('*').in('playlist_id', ids).order('added_at') : { data: [] }
    if (current !== version.current) return
    if (members.error) setError('Liste şarkıları yüklenemedi.')
    else { setPlaylists(result.data); setMemberships(members.data) }
    setLoading(false)
  }, [ownerId])
  useEffect(() => { refresh(); return () => { version.current++ } }, [refresh])
  const playlist = playlists.find(p => String(p.id) === String(selected))
  const memberIds = new Set(memberships.filter(m => String(m.playlist_id) === String(selected)).map(m => m.item_id))
  const sections = gridProps.sections.map(section => ({ ...section, items: playlist ? section.items.filter(i => memberIds.has(i.id)) : section.items }))
  async function create(event) {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true); setError('')
    const result = await supabase.from('music_playlists').insert({ user_id: ownerId, name: name.trim() }).select().single()
    if (result.error) setError('Liste oluşturulamadı.')
    else { setPlaylists(prev => [...prev, result.data]); setSelected(result.data.id); setName(''); setCreating(false); setEditing(true) }
    setBusy(false)
  }
  async function toggle(itemId) {
    const exists = memberIds.has(itemId)
    const query = exists ? supabase.from('music_playlist_items').delete().eq('playlist_id', playlist.id).eq('item_id', itemId)
      : supabase.from('music_playlist_items').insert({ playlist_id: playlist.id, item_id: itemId })
    const result = await query
    if (result.error) throw new Error('Liste güncellenemedi. Tekrar dene.')
    setMemberships(prev => exists ? prev.filter(m => !(m.playlist_id === playlist.id && m.item_id === itemId)) : [...prev, { playlist_id: playlist.id, item_id: itemId }])
  }
  async function rename(value) {
    if (!value) return
    const result = await supabase.from('music_playlists').update({ name: value }).eq('id', playlist.id).select().single()
    if (result.error) throw new Error('Liste adı kaydedilemedi.')
    setPlaylists(prev => prev.map(p => p.id === playlist.id ? result.data : p))
  }
  async function remove() {
    if (!window.confirm(`“${playlist.name}” listesi silinsin mi? Şarkılar Şarkılarım’da kalacak.`)) return
    setBusy(true); setError('')
    const result = await supabase.from('music_playlists').delete().eq('id', playlist.id)
    if (result.error) setError('Liste silinemedi.')
    else { setPlaylists(prev => prev.filter(p => p.id !== playlist.id)); setSelected('all') }
    setBusy(false)
  }
  return <>
    <section className="music-collection-controls" aria-label="Çalma listeleri">
      <div className="music-collection-navigation" role="group" aria-label="Müzik listeleri">
        <button type="button" className={'filter-btn' + (!playlist ? ' active' : '')} aria-pressed={!playlist} onClick={() => { setSelected('all'); setEditing(false) }}>{isOwner ? 'Listem' : 'Listesi'} ({allSongs.length})</button>
        <select className={'sort-select music-playlist-select' + (playlist ? ' selected' : '')} aria-label={isOwner ? 'Çalma listelerim' : 'Çalma listeleri'} value={playlist?.id ?? ''} onChange={e => { setSelected(e.target.value); setEditing(false) }}>
          <option value="" disabled hidden>{isOwner ? 'Çalma listelerim' : 'Çalma listeleri'}</option>
          {!playlists.length && <option disabled>Henüz çalma listesi yok</option>}
          {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="music-collection-toolbar">
        <button className="filter-btn" disabled={!sections[0]?.items.length} onClick={() => setPlaying(sections[0].items)}>▷ Listeyi dinle</button>
        {isOwner && <button className="filter-btn" aria-expanded={creating} onClick={() => setCreating(v => !v)}>{creating ? 'Vazgeç' : '+ Çalma listesi'}</button>}
        {playlist && isOwner && <details className="music-playlist-menu" key={playlist.id}>
          <summary aria-label="Çalma listesi işlemleri">⋯</summary>
          <div className="item-overflow-panel">
            <button type="button" className="edit" onClick={e => { e.currentTarget.closest('details').open = false; setEditing(true) }}>Listeyi düzenle</button>
            <button type="button" className="delete" disabled={busy} onClick={e => { e.currentTarget.closest('details').open = false; remove() }}>Listeyi sil</button>
          </div>
        </details>}
      </div>
      {creating && <form className="music-search-bar" onSubmit={create}><input aria-label="Yeni çalma listesinin adı" placeholder="Liste adı" maxLength={100} value={name} onChange={e => setName(e.target.value)} /><button className="btn-save" disabled={busy || !name.trim()}>Oluştur</button></form>}
      {loading && <p role="status">Çalma listeleri yükleniyor…</p>}
      {error && <p className="auth-error" role="alert">{error} <button onClick={refresh}>Tekrar dene</button></p>}
    </section>
    {playlist && !sections[0]?.items.length ? <p>Bu görünümde şarkı yok. {isOwner ? 'Listeyi düzenleyerek Şarkılarım’dan şarkı ekleyebilirsin.' : ''}</p> : <ItemsGrid {...gridProps} sections={sections} />}
    {editing && playlist && <PlaylistEditor key={playlist.id} playlist={playlist} songs={allSongs} members={memberIds} onToggle={toggle} onRename={rename} onClose={() => setEditing(false)} />}
    {playing && <MusicPlayer items={playing.map(song => savedVideos[song.id] ? { ...song, youtube_id: savedVideos[song.id] } : song)} onVideoSaved={(id, video) => setSavedVideos(prev => ({ ...prev, [id]: video }))} onClose={() => setPlaying(null)} />}
  </>
}
