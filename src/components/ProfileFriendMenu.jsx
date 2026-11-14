import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import FriendActions from './FriendActions'

export default function ProfileFriendMenu({ personId, isPublic }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null), button = useRef(null), panel = useRef(null)
  const id = useId()
  function close() { setOpen(false); button.current?.focus({ preventScroll: true }) }
  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const rect = button.current.getBoundingClientRect()
      const avatar = root.current.closest('.visitor-profile-hero')?.querySelector('.profile-avatar')?.getBoundingClientRect()
      const viewportRight = document.documentElement.clientWidth - 12
      // Keep the entire menu to the right of the photo, even on narrow screens.
      const safeLeft = Math.max(12, (avatar?.right ?? 0) + 12)
      const width = Math.min(260, Math.max(1, viewportRight - safeLeft))
      const left = Math.max(safeLeft, Math.min(rect.left, viewportRight - width))
      panel.current.style.width = `${width}px`
      panel.current.style.left = `${left - rect.left}px`
    }
    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  }, [open])
  useEffect(() => {
    if (!open) return
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false) }
    function escape(event) { if (event.key === 'Escape') { event.preventDefault(); close() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className="profile-friend-menu" ref={root}>
    <button ref={button} type="button" className="profile-friend-toggle" aria-label="Arkadaşlık işlemleri" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
    </button>
    {open && <div id={id} ref={panel} className="profile-friend-menu-panel"><FriendActions compact personId={personId} isPublic={isPublic} onComplete={close} /></div>}
  </div>
}
