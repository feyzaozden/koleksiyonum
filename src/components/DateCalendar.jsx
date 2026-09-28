import { useState } from 'react'
import { localToday } from '../utils/itemDates'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function DateCalendar({ value, min, max, onSelect }) {
  const initial = value || localToday()
  const [year, setYear] = useState(Number(initial.slice(0, 4)))
  const [month, setMonth] = useState(Number(initial.slice(5, 7)))
  const validYear = Number.isInteger(year) && year >= 1 && year <= 9999
  const first = new Date(0)
  first.setUTCHours(0, 0, 0, 0)
  first.setUTCFullYear(validYear ? year : 2000, month - 1, 1)
  const offset = (first.getUTCDay() + 6) % 7
  const last = new Date(first)
  last.setUTCMonth(month, 0)
  const count = last.getUTCDate()
  function moveMonth(delta) {
    const next = new Date(first)
    next.setUTCMonth(next.getUTCMonth() + delta)
    setYear(next.getUTCFullYear()); setMonth(next.getUTCMonth() + 1)
  }
  return <div className="date-picker-panel" role="group" aria-label="Takvim" onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); if (event.target.tagName !== 'BUTTON') event.preventDefault() } }}>
    <div className="date-picker-toolbar">
      <button type="button" aria-label="Önceki ay" disabled={!validYear || (year === 1 && month === 1)} onClick={() => moveMonth(-1)}>‹</button>
      <select aria-label="Takvim ayı" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
        {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
      </select>
      <input aria-label="Takvim yılı" type="text" inputMode="numeric" maxLength={4} value={year || ''} onChange={(event) => { if (/^\d*$/.test(event.target.value)) setYear(Number(event.target.value)) }} />
      <button type="button" aria-label="Sonraki ay" disabled={!validYear || (year === 9999 && month === 12)} onClick={() => moveMonth(1)}>›</button>
    </div>
    {validYear ? <div className="date-picker-grid">
      {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'].map((day) => <span key={day} aria-hidden="true">{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: count }, (_, index) => {
        const day = index + 1
        const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return <button key={iso} type="button" aria-label={`${day} ${MONTHS[month - 1]} ${year}`} aria-pressed={iso === value}
          disabled={Boolean((min && iso < min) || (max && iso > max))} onClick={() => onSelect(iso)}>{day}</button>
      })}
    </div> : <p role="status">Geçerli bir yıl gir.</p>}
  </div>
}
