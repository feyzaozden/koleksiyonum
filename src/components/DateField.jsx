import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { displayDate, dateInputError, parseDate } from '../utils/itemDates'
import DateCalendar from './DateCalendar'

export default function DateField({ value, onChange, label, min, max, calendarMin = min }) {
  const id = useId()
  const inputs = useRef([])
  const [blurred, setBlurred] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarButton = useRef(null)
  const wrapper = useRef(null)
  const panel = useRef(null)
  const [placement, setPlacement] = useState(null)
  useLayoutEffect(() => {
    if (!calendarOpen) return
    const anchor = calendarButton.current.closest('.date-field').getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 24)
    const height = panel.current.getBoundingClientRect().height
    const below = window.innerHeight - anchor.bottom - 12
    const above = anchor.top - 12
    const opensBelow = below >= height || below >= above
    const maxHeight = Math.max(60, opensBelow ? below - 6 : above - 6)
    setPlacement({
      left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)),
      top: opensBelow ? anchor.bottom + 6 : Math.max(12, anchor.top - Math.min(height, maxHeight) - 6),
      width, maxHeight,
    })
  }, [calendarOpen])
  useEffect(() => {
    if (!calendarOpen) return
    function closeOutside(event) {
      if (!wrapper.current?.contains(event.target)) setCalendarOpen(false)
    }
    function closeOnScroll(event) {
      if (!panel.current?.contains(event.target)) setCalendarOpen(false)
    }
    const close = () => setCalendarOpen(false)
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [calendarOpen])
  const parts = value ? value.split('/') : ['', '', '']
  const error = dateInputError(value, { min, max }) || (blurred && value && !/^\d{2}\/\d{2}\/\d{4}$/.test(value) ? 'Gün, ay ve yılı tamamla.' : '')
  let iso = ''
  try { iso = parseDate(value) || '' } catch { /* Preserve incomplete input. */ }
  function updatePart(index, raw) {
    if (!/^\d*$/.test(raw)) return
    const next = [...parts]
    next[index] = raw.slice(0, index === 2 ? 4 : 2)
    const text = next.some(Boolean) ? next.join('/') : ''
    onChange(text)
    setBlurred(false)
    if (index < 2 && raw.length === 2 && raw.length > parts[index].length && !dateInputError(text)) {
      inputs.current[index + 1]?.focus()
      inputs.current[index + 1]?.select()
    }
  }
  return <div ref={wrapper} className="date-field-wrapper">
    <div className="date-field date-segments" role="group" aria-label={label}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setBlurred(true) }}>
      {['Gün', 'Ay', 'Yıl'].map((part, index) => <span className="date-segment" key={part}>
        {index > 0 && <span className="date-separator" aria-hidden="true">/</span>}
        <input ref={(element) => { inputs.current[index] = element }} type="text" aria-label={`${label}: ${part}`} inputMode="numeric" autoComplete="off"
          placeholder={index === 2 ? 'yyyy' : index === 1 ? 'mm' : 'dd'} maxLength={index === 2 ? 4 : 2}
          value={parts[index] || ''} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onFocus={(event) => { event.target.select(); setCalendarOpen(false) }}
          onChange={(event) => updatePart(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !/\d/.test(event.key)) event.preventDefault()
          }} />
      </span>)}
      <button ref={calendarButton} className="date-calendar date-calendar-toggle" type="button" aria-label={`${label} için takvim aç`} aria-expanded={calendarOpen} aria-controls={`${id}-calendar`} onClick={() => setCalendarOpen(!calendarOpen)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
      </button>
    </div>
    {calendarOpen && <div ref={panel} className="date-picker-popup" style={placement || { visibility: 'hidden', width: Math.min(300, window.innerWidth - 24) }} id={`${id}-calendar`} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setCalendarOpen(false); calendarButton.current?.focus({ preventScroll: true }) } }}>
      <DateCalendar value={iso} min={calendarMin} max={max} onSelect={(date) => { onChange(displayDate(date)); setBlurred(false); setCalendarOpen(false); calendarButton.current?.focus({ preventScroll: true }) }} />
    </div>}
    {error && <small id={`${id}-error`} className="date-field-error" role="alert">{error}</small>}
  </div>
}
