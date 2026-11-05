import { useEffect, useRef, useState } from 'react'

export default function CommentDelete({ onDelete, onClose }) {
  const dialog = useRef(null)
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  async function remove() {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { await onDelete(); onClose() }
    catch (err) { setError(err.message || 'Yorum silinemedi.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="delete-dialog" aria-labelledby="comment-delete-title" onCancel={e => { e.preventDefault(); if (!inFlight.current) onClose() }}>
    <h2 id="comment-delete-title">Yorumu silmek istiyor musun?</h2>
    <p>Yorum metni kaldırılacak. Altındaki cevaplar korunacak. Bu işlem geri alınamaz.</p>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <div className="modal-actions"><button autoFocus disabled={busy} onClick={onClose}>Vazgeç</button><button className="btn-danger" disabled={busy} onClick={remove}>{busy ? 'Siliniyor…' : 'Yorumu sil'}</button></div>
  </dialog>
}
