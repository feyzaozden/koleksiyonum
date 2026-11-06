import { useState } from 'react'
import CommentsPage from '../pages/CommentsPage'

export default function MyCommentsPanel() {
  const [expanded, setExpanded] = useState(false)
  return <section className="profile-password" aria-label="Yorumlarım">
    <button type="button" className="password-toggle" aria-expanded={expanded} aria-controls="profile-comments" onClick={() => setExpanded(v => !v)}>
      <span>Yorumlarım</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <div id="profile-comments"><CommentsPage mine embedded /></div>}
  </section>
}
