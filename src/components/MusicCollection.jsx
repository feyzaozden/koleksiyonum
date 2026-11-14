import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePageState } from '../hooks/usePageState'
import ItemsGrid from './ItemsGrid'
import MusicPlayer from './MusicPlayer'
import AddToPlaylist from './AddToPlaylist'
import DeleteConfirm from './DeleteConfirm'
import PlaylistAppearance, { PlaylistCover } from './PlaylistAppearance'

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

export default function MusicCollection({ ownerId, allSongs, gridProps, filters }) {
  const isOwner = gridProps.sections[0]?.isOwner
  const [playlists, setPlaylists] = useState([])
  const [library, setLibrary] = useState({})
  const [appearance, setAppearance] = useState(false)
  const [deletingPlaylist, setDeletingPlaylist] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [selected, setSelected] = usePageState(`playlist-cards:${ownerId}`, null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [addingSong, setAddingSong] = useState(null)
  const [savedVideos, setSavedVideos] = useState({})
  const version = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++version.current
    setLoading(true); setError('')
    const result = await supabase.from('music_playlists').select('*').eq('user_id', ownerId).order('created_at')
    if (current !== version.current) return
    if (result.error) { setError('Çalma listeleri yüklenemedi. Müzik SQL kurulumunu kontrol et.'); setLoading(false); return }
    const profile = await supabase.from('profiles').select('music_description,music_cover_path').eq('id', ownerId).single()
    if (current !== version.current) return
    if (profile.error) setError('Liste kapakları yüklenemedi. Yeni liste kapakları SQL dosyasını çalıştırmalısın.')
    else setLibrary({ description: profile.data.music_description, cover_path: profile.data.music_cover_path })
    const ids = result.data.map(p => p.id)
    const members = ids.length ? await supabase.from('music_playlist_items').select('*').in('playlist_id', ids).order('added_at') : { data: [] }
    if (current !== version.current) return
    if (members.error) setError('Liste şarkıları yüklenemedi.')
    else { setPlaylists(result.data); setMemberships(members.data) }
    setLoading(false)
  }, [ownerId])
  useEffect(() => { refresh(); return () => { version.current++ } }, [refresh])
  const playlist = playlists.find(p => String(p.id) === String(selected))
  const currentCollection = playlist || { ...library, name: isOwner ? 'Listem' : 'Listesi' }
  const opened = selected === 'all' || !!playlist
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
  async function addToPlaylist(playlistId, itemId) {
    const result = await supabase.from('music_playlist_items').insert({ playlist_id: playlistId, item_id: itemId })
    if (result.error && result.error.code !== '23505') throw new Error('Şarkı listeye eklenemedi. Tekrar dene.')
    setMemberships(prev => prev.some(m => m.playlist_id === playlistId && m.item_id === itemId) ? prev : [...prev, { playlist_id: playlistId, item_id: itemId }])
  }
  async function remove(playlistId) {
    const result = await supabase.from('music_playlists').delete().eq('id', playlistId).eq('user_id', ownerId).select('id').single()
    if (result.error) throw new Error('Çalma listesi silinemedi. Tekrar dene.')
    setPlaylists(prev => prev.filter(p => p.id !== playlistId))
    setMemberships(prev => prev.filter(m => m.playlist_id !== playlistId))
    setSelected(null)
  }
  return <>
    <section className="music-collection-controls" aria-label="Çalma listeleri">
      {opened && <div className="playlist-open-heading"><button type="button" className="btn-cancel" onClick={() => { setSelected(null); setEditing(false) }}>← Çalma listeleri</button><h2>{currentCollection.name}</h2>{currentCollection.description && <p>{currentCollection.description}</p>}</div>}
      <div className="music-collection-toolbar">
        {opened && <button className="filter-btn" disabled={!sections[0]?.items.length} onClick={() => setPlaying(sections[0].items)}>▷ Listeyi dinle</button>}
        {opened && isOwner && <button className="filter-btn" onClick={() => setAppearance(true)}>Kapak ve açıklama</button>}
        {isOwner && <button className="filter-btn" aria-expanded={creating} onClick={() => setCreating(v => !v)}>{creating ? 'Vazgeç' : '+ Çalma listesi'}</button>}
        {playlist && isOwner && <details className="music-playlist-menu" key={playlist.id}>
          <summary aria-label="Çalma listesi işlemleri">⋯</summary>
          <div className="item-overflow-panel">
            <button type="button" className="edit" onClick={e => { e.currentTarget.closest('details').open = false; setEditing(true) }}>Listeyi düzenle</button>
            <button type="button" className="delete" disabled={busy} onClick={e => { e.currentTarget.closest('details').open = false; setDeletingPlaylist(playlist) }}>Listeyi sil</button>
          </div>
        </details>}
      </div>
      {creating && <form className="music-search-bar" onSubmit={create}><input aria-label="Yeni çalma listesinin adı" placeholder="Liste adı" maxLength={100} value={name} onChange={e => setName(e.target.value)} /><button className="btn-save" disabled={busy || !name.trim()}>Oluştur</button></form>}
      {loading && <p role="status">Çalma listeleri yükleniyor…</p>}
      {error && <p className="auth-error" role="alert">{error} <button onClick={refresh}>Tekrar dene</button></p>}
    </section>
    {!opened && <div className="playlist-card-grid">
      {[{ ...library, id: 'all', name: isOwner ? 'Listem' : 'Listesi' }, ...playlists].map(p => <button type="button" className="playlist-card" key={p.id} onClick={() => setSelected(p.id)}>
        <PlaylistCover path={p.cover_path} /><strong>{p.name}</strong>
        <small>{p.id === 'all' ? allSongs.length : memberships.filter(m => m.playlist_id === p.id).length} şarkı</small>
        {p.description && <span className="playlist-card-description">{p.description}</span>}
      </button>)}
    </div>}
    {opened && filters}
    {deletingPlaylist && <DeleteConfirm playlist item={deletingPlaylist} onCancel={() => setDeletingPlaylist(null)} onConfirm={remove} />}
    {opened && (playlist && !sections[0]?.items.length ? <p>{memberIds.size ? 'Aramana uygun şarkı bulunamadı.' : 'Bu çalma listesi henüz boş.'} {isOwner && !memberIds.size && <>Listem’deki bir şarkının ⋯ menüsünden “Çalma listesine ekle”yi seçebilirsin.</>}</p> : <ItemsGrid {...gridProps} sections={sections} onAddToPlaylist={setAddingSong} />)}
    {appearance && opened && <PlaylistAppearance collection={currentCollection} ownerId={ownerId} onClose={() => setAppearance(false)} onSave={async values => {
      const result = playlist
        ? await supabase.from('music_playlists').update(values).eq('id', playlist.id).select().single()
        : await supabase.from('profiles').update({ music_description: values.description, music_cover_path: values.cover_path }).eq('id', ownerId).select('id').single()
      if (result.error) throw new Error('Liste görünümü kaydedilemedi. SQL kurulumunu ve bağlantını kontrol et.')
      if (playlist) setPlaylists(prev => prev.map(p => p.id === playlist.id ? result.data : p))
      else setLibrary(values)
    }} />}
    {addingSong && <AddToPlaylist song={addingSong} playlists={playlists} memberships={memberships} loading={loading} loadError={error} onRetry={refresh} onAdd={addToPlaylist} onClose={() => setAddingSong(null)} onCreate={() => { setAddingSong(null); setCreating(true) }} />}
    {editing && playlist && <PlaylistEditor key={playlist.id} playlist={playlist} songs={allSongs} members={memberIds} onToggle={toggle} onRename={rename} onClose={() => setEditing(false)} />}
    {playing && <MusicPlayer items={playing.map(song => savedVideos[song.id] ? { ...song, youtube_id: savedVideos[song.id] } : song)} onVideoSaved={(id, video) => setSavedVideos(prev => ({ ...prev, [id]: video }))} onClose={() => setPlaying(null)} />}
  </>
}
