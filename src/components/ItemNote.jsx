import { useEffect, useId, useRef, useState } from 'react'

export default function ItemNote({ note }) {
  const paragraph = useRef(null)
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const element = paragraph.current
    let active = true
    function measure() {
      if (!active) return
      // Measure the collapsed height even when the reader has expanded the note.
      element.classList.add('item-note-clamped')
      setOverflows(element.scrollHeight > element.clientHeight + 1)
      if (expanded) element.classList.remove('item-note-clamped')
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    document.fonts?.ready.then(measure)
    return () => { active = false; observer.disconnect() }
  }, [note, expanded])
  return <div className="item-note-block">
    <p ref={paragraph} id={id} className={'item-note' + (expanded ? '' : ' item-note-clamped')}>&quot;{note}&quot;</p>
    {overflows && <button type="button" className="item-note-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? 'Daha az göster' : 'Devamını göster'}</button>}
  </div>
}
