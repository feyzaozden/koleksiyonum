import { useId, useRef, useState } from 'react'
import { displayDate, dateInputError, parseDate } from '../utils/itemDates'

export default function DateField({ value, onChange, label, min, max }) {
  const id = useId()
  const inputs = useRef([])
  const [blurred, setBlurred] = useState(false)
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
  return <div className="date-field-wrapper">
    <div className="date-field date-segments" role="group" aria-label={label}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setBlurred(true) }}>
      {['Gün', 'Ay', 'Yıl'].map((part, index) => <span className="date-segment" key={part}>
        {index > 0 && <span className="date-separator" aria-hidden="true">/</span>}
        <input ref={(element) => { inputs.current[index] = element }} type="text" aria-label={`${label}: ${part}`} inputMode="numeric" autoComplete="off"
          placeholder={index === 2 ? 'yyyy' : index === 1 ? 'mm' : 'dd'} maxLength={index === 2 ? 4 : 2}
          value={parts[index] || ''} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => updatePart(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !/\d/.test(event.key)) event.preventDefault()
          }} />
      </span>)}
      <span className="date-calendar">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
        <input type="date" aria-label={`${label} için takvim aç`} value={iso} min={min || '0001-01-01'} max={max || '9999-12-31'}
          onClick={(event) => { try { event.currentTarget.showPicker?.() } catch { /* Native fallback. */ } }}
          onChange={(event) => { onChange(displayDate(event.target.value)); setBlurred(false) }} />
      </span>
    </div>
    {error && <small id={`${id}-error`} className="date-field-error" role="alert">{error}</small>}
  </div>
}
