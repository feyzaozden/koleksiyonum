import { useEffect, useId, useRef, useState } from 'react'

export default function ItemMenu({ item, onEdit, onDelete, onFinish }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null), button = useRef(null), id = useId()
  useEffect(() => {
    if (!open) return
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className="item-overflow" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button type="button" ref={button} className="item-overflow-toggle" aria-label={`${item.title} işlemleri`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>⋯</button>
    {open && <div className="item-overflow-panel" id={id}>{item.category !== 'muzik' && item.status !== 'bitti' && <button type="button" onClick={() => { onFinish(); setOpen(false) }}>Bitirdim</button>}<button type="button" className="edit" onClick={() => { onEdit(); setOpen(false) }}>Düzenle</button><button type="button" className="delete" onClick={() => { onDelete(); setOpen(false) }}>Sil</button></div>}
  </div>
}
