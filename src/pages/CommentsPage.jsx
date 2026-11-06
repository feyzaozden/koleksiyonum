import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import AppHeader from '../components/AppHeader'
import ProfileAvatar from '../components/ProfileAvatar'
import CommentForm from '../components/CommentForm'
import CommentDelete from '../components/CommentDelete'
import { orderCommentThreads } from '../utils/commentThreads'
import { refreshCommentPages } from '../utils/refreshCommentPages'

export default function CommentsPage({ mine = false, embedded = false }) {
  const { id } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const focus = new URLSearchParams(location.search).get('comment')
  // A new target/account gets a fresh state and cannot display the previous thread.
  return <CommentsContent key={`${user.id}:${mine}:${id}:${focus}`} mine={mine} embedded={embedded} id={id} focus={focus} />
}

function CommentsContent({ mine, embedded, id, focus }) {
  const [entries, setEntries] = useState([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allowed, setAllowed] = useState(false)
  const [more, setMore] = useState(false)
  const [reply, setReply] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const alive = useRef(true)
  const actionLock = useRef(false)
  const entryRef = useRef([])
  const nextCursor = useRef(0)
  const valid = mine || /^[1-9]\d{0,15}$/.test(id || '')

  const load = useCallback(async ({ append = false, focused = focus, preserve = false } = {}) => {
    const request = ++generation.current
    setLoading(true); setError('')
    if (!valid) { setLoading(false); setError('Geçersiz içerik.'); return }
    const last = entryRef.current.at(-1)?.id
    const result = mine
      ? await supabase.rpc('get_my_comments', { before_id: append ? last : null })
      : preserve
      ? await refreshCommentPages(cursor => supabase.rpc('get_item_comments', { target_item_id: id, after_id: cursor, focus_id: null }), nextCursor.current, focused)
        .catch(error => ({ error }))
      : await supabase.rpc('get_item_comments', { target_item_id: id, after_id: append ? nextCursor.current : 0, focus_id: !append && /^[1-9]\d{0,15}$/.test(focused || '') ? focused : null })
    if (!alive.current || request !== generation.current) return
    setLoading(false)
    if (result.error) {
      setEntries([]); entryRef.current = []; setAllowed(false); setMore(false)
      setError(result.error.message || 'Yorumlar yüklenemedi.'); return
    }
    const rows = mine ? result.data : result.data.entries
    if (!mine) nextCursor.current = result.data.next_after ?? rows.at(-1)?.id ?? 0
    const next = append ? [...entryRef.current, ...rows] : rows
    entryRef.current = next; setEntries(mine ? next : orderCommentThreads(next)); setAllowed(true)
    setMore(mine ? rows.length === 50 : result.data.has_more)
    if (!mine) setTitle(result.data.title)
    if (!append && focused) requestAnimationFrame(() => {
      if (!alive.current) return
      const card = document.getElementById(`comment-${focused}`)
      card?.scrollIntoView({ block: 'center', behavior: 'smooth' }); card?.focus({ preventScroll: true })
    })
  }, [mine, id, focus, valid])

  useEffect(() => {
    alive.current = true
    load()
    const refresh = () => { if (!actionLock.current) load({ preserve: true, focused: null }) }
    window.addEventListener('focus', refresh)
    return () => { alive.current = false; generation.current++; window.removeEventListener('focus', refresh) }
  }, [load])

  async function send(content, anonymous, parent) {
    const { data, error: failure } = await supabase.rpc('add_item_comment', { target_item_id: id, content, as_anonymous: anonymous, reply_to: parent })
    if (failure) throw failure
    if (alive.current) { setReply(null); await load({ focused: String(data), preserve: true }) }
  }
  async function react(entry, value) {
    if (actionLock.current) return
    actionLock.current = true; setBusy(true); setError('')
    try {
      const { error: failure } = await supabase.rpc('set_comment_reaction', { target_comment_id: entry.id, reaction_value: entry.my_reaction === value ? null : value })
      if (failure) throw failure
      await load({ focused: String(entry.id), preserve: true })
    } catch (err) { if (alive.current) setError(err.message) }
    finally { actionLock.current = false; if (alive.current) setBusy(false) }
  }
  async function remove() {
    const { error: failure } = await supabase.rpc('delete_item_comment', { target_comment_id: deleting.id })
    if (failure) throw failure
    if (reply?.id === deleting.id) setReply(null)
    await load({ focused: null, preserve: true })
  }

  const Container = embedded ? 'div' : 'main'
  return <>{!embedded && <AppHeader />}<Container className={embedded ? 'comments-page comments-embedded' : 'social-main comments-page'}>
    {mine && !embedded && <Link to="/profile">← Profilim</Link>}
    {!embedded && <h1>{mine ? 'Yorumlarım' : title ? `${title} · Yorumlar` : 'Yorumlar'}</h1>}
    {mine && <p>Arkadaşlığın sona erse de burada kendi yorumlarını silebilirsin.</p>}
    {error && <p className="auth-error" role="alert">{error} <button onClick={() => load()}>Tekrar dene</button></p>}
    {loading && <p role="status">Yükleniyor…</p>}
    {!mine && allowed && <CommentForm key={reply?.id || 'new'} reply={reply} onCancel={() => setReply(null)} onSend={send} />}
    {!loading && allowed && !entries.length && <p>Henüz yorum yok.</p>}
    <div className="comments-list">{entries.filter(entry => !entry.deleted).map(entry => <article tabIndex={-1} id={`comment-${entry.id}`} key={entry.id} className={`comment-card ${entry.parent_id && entry.parent_preview ? 'comment-reply' : ''}`}>
      {mine ? <h2>{entry.title}</h2> : <div className="comment-author">
        {!entry.anonymous && entry.profile_id ? <Link to={`/people/${entry.profile_id}`}><ProfileAvatar compact profile={entry} /> @{entry.username}</Link> : <strong>Anonim</strong>}
        {entry.own && <small>Sen</small>}
      </div>}
      <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</time>
      {entry.parent_id && entry.parent_preview && <blockquote>Cevap: {entry.parent_preview}</blockquote>}
      <p className="comment-body">{entry.body}</p>
      {mine && entry.anonymous && <small>Anonim paylaştın</small>}
      <div className="comment-actions">
        {!mine && !entry.deleted && <>
          {[1, -1].map(value => <button key={value} disabled={busy || loading || entry.own} aria-pressed={entry.my_reaction === value} aria-label={value === 1 ? 'Yorumu beğen' : 'Yorumu beğenme'} onClick={() => react(entry, value)}>{value === 1 ? '👍' : '👎'} {value === 1 ? entry.likes : entry.dislikes}</button>)}
          {!entry.parent_id && <button onClick={() => { setReply(entry); document.getElementById('comment-body')?.scrollIntoView({ block: 'center' }) }}>Cevapla</button>}
        </>}
        {mine && entry.can_open && <Link to={`/items/${entry.item_id}/comments?comment=${entry.id}`}>Yoruma git</Link>}
        {(mine || entry.can_delete) && <button disabled={busy} onClick={() => setDeleting(entry)}>Sil</button>}
      </div>
    </article>)}</div>
    {more && <button disabled={loading || busy} onClick={() => load({ append: true })}>Daha fazla yorum</button>}
    {deleting && <CommentDelete onClose={() => setDeleting(null)} onDelete={remove} />}
  </Container></>
}
