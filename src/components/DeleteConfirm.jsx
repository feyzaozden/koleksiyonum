import { useEffect, useRef, useState } from 'react'

export default function DeleteConfirm({ item, onCancel, onConfirm }) {
  const dialog = useRef(null)
  const cancelButton = useRef(null)
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element.showModal()
    cancelButton.current.focus()
    return () => {
      element.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      await onConfirm(item.id)
      onCancel()
    } catch (err) {
      setError('Silinemedi. ' + (err.message || 'Lütfen tekrar dene.'))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-description"
      onCancel={(event) => { event.preventDefault(); if (!inFlight.current) onCancel() }}>
      <div className="delete-dialog-symbol" aria-hidden="true">−</div>
      <p className="eyebrow">Koleksiyondan kaldır</p>
      <h2 id="delete-title">Bu öğeyi silmek istiyor musun?</h2>
      <p id="delete-description"><strong>{item.title}</strong> koleksiyonundan, puanı ve notlarıyla birlikte silinecek. Bu işlem geri alınamaz.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button ref={cancelButton} className="btn-cancel" disabled={busy} onClick={onCancel}>Vazgeç</button>
        <button className="btn-danger" disabled={busy} onClick={confirm}>{busy ? 'Siliniyor…' : 'Evet, sil'}</button>
      </div>
    </dialog>
  )
}
