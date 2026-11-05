import { useRef, useState } from 'react'
import { commentError } from '../utils/commentValidation'

export default function CommentForm({ reply, onCancel, onSend }) {
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  async function submit(e) {
    e.preventDefault()
    if (sending.current) return
    const validation = commentError(text)
    if (validation) { setError(validation); return }
    sending.current = true; setBusy(true); setError('')
    try {
      await onSend(text.trim(), anonymous, reply?.id ?? null)
      setText(''); setAnonymous(false)
    } catch (err) { setError(err.message || 'Yorum gönderilemedi.') }
    finally { sending.current = false; setBusy(false) }
  }
  return <form className="comment-form" onSubmit={submit}>
    <label htmlFor="comment-body">{reply ? 'Cevabın' : 'Yorumun'}</label>
    {reply && <div className="comment-reply-preview"><p>{reply.body}</p><button type="button" disabled={busy} onClick={onCancel}>Cevaplamaktan vazgeç</button></div>}
    <textarea id="comment-body" rows={4} value={text} disabled={busy} onChange={e => setText(e.target.value)} />
    <label className="comment-anonymous"><input type="checkbox" checked={anonymous} disabled={busy} onChange={e => setAnonymous(e.target.checked)} /> Anonim paylaş</label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="auth-btn" disabled={busy || Boolean(commentError(text))}>{busy ? 'Gönderiliyor…' : reply ? 'Cevabı gönder' : 'Yorum yap'}</button>
  </form>
}
