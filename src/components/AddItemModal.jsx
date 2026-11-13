import { useEffect, useRef, useState } from 'react'
import AddForm from './AddForm'

export default function AddItemModal({ category, creatorLabel, existingItems, onSubmit, onClose }) {
  const dialog = useRef(null)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    element.querySelector('input')?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  async function submit(payload) {
    if (saving.current) return false
    saving.current = true; setBusy(true)
    try {
      const result = await onSubmit(payload)
      if (result !== false) onClose()
      return result
    } finally { saving.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="add-item-dialog" aria-labelledby="add-item-heading" onCancel={event => { event.preventDefault(); if (!saving.current) onClose() }}>
    <div className="add-item-dialog-heading"><h2 id="add-item-heading">{({ kitap: 'Kitap', film: 'Film', dizi: 'Dizi' })[category]} ekle</h2><button type="button" aria-label="Ekleme penceresini kapat" disabled={busy} onClick={onClose}>×</button></div>
    <AddForm category={category} creatorLabel={creatorLabel} existingItems={existingItems} onSubmit={submit} />
  </dialog>
}
