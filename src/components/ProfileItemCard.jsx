import { useEffect, useRef, useState } from 'react'
import ItemCover from './ItemCover'
import ItemCard from './ItemCard'
import { TABS } from '../constants/tabs'

function Detail({ item, reactions, commentCount, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const el = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow
    el.showModal(); document.body.style.overflow = 'hidden'
    return () => { el.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className="add-item-dialog profile-item-dialog" aria-label={`${item.title} ayrıntıları`} onCancel={e => { e.preventDefault(); onClose() }}>
    <div className="add-item-dialog-heading"><h2>İçerik ayrıntıları</h2><button type="button" onClick={onClose} aria-label="Kapat">×</button></div>
    <ItemCard item={item} isOwner={false} labels={TABS[item.category]?.statusLabels || {}} reactions={reactions} commentCount={commentCount} returnAnchorId={`profile-item-${item.id}`} />
  </dialog>
}

export default function ProfileItemCard({ item, reactions, commentCount }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" id={`profile-item-${item.id}`} className="profile-item-tile" onClick={() => setOpen(true)} aria-label={`${item.title}, ayrıntıları aç`}>
      <ItemCover item={item} />
      <span className="profile-item-copy"><strong>{item.title}</strong>{item.creator && <span>{item.creator}</span>}{item.rating != null && <small>★ {item.rating}/10</small>}</span>
    </button>
    {open && <Detail item={item} reactions={reactions} commentCount={commentCount} onClose={() => setOpen(false)} />}
  </>
}
