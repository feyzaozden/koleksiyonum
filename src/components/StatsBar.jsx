import { useMemo, useState } from 'react'
import { getCompletionStats, getCurrentMonth, getMonthlyCompletionStats } from '../utils/collectionStats'

const CATEGORY_LABELS = { kitap: 'Kitap', film: 'Film', dizi: 'Dizi' }
const CATEGORY_EMOJIS = { kitap: '📚', film: '🎬', dizi: '📺' }

function formatActivityDate(value) {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))
}

function MonthlyActivityList({ title, items, dateField, showRating = false, loading, error }) {
  return (
    <section className="monthly-activity" aria-label={title}>
      <h3>{title}<span>{loading || error ? '—' : items.length}</span></h3>
      {loading || error ? (
        <p className="monthly-activity-empty">{error ? 'Veriler alınamadı.' : 'Yükleniyor…'}</p>
      ) : items.length === 0 ? (
        <p className="monthly-activity-empty">Bu ay için kayıt yok.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span className="monthly-activity-icon" aria-hidden="true">{item.emoji || CATEGORY_EMOJIS[item.category]}</span>
              <div className="monthly-activity-item">
                <strong>{item.title}</strong>
                <span>{[CATEGORY_LABELS[item.category], item.creator, item.year].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="monthly-activity-meta">
                <time dateTime={item[dateField]}>{formatActivityDate(item[dateField])}</time>
                {showRating && <span>{item.rating == null ? 'Puanlanmadı' : `${item.rating}/10`}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function StatsBar({ items, collectionItems = items, labels, loading = false, error = false }) {
  const currentMonth = useMemo(() => getCurrentMonth(), [])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const counts = {
    tumu: items.length,
    bekliyor: items.filter((i) => i.status === 'bekliyor').length,
    devam: items.filter((i) => i.status === 'devam').length,
    bitti: items.filter((i) => i.status === 'bitti').length,
  }
  const completion = getCompletionStats(collectionItems)
  const completionLabel = loading ? 'Yükleniyor…'
    : error ? 'Veriler alınamadı'
      : completion.total === 0 ? 'Henüz içerik yok'
        : `${completion.completed} / ${completion.total} içerik tamamlandı`
  const monthlyCompletion = getMonthlyCompletionStats(collectionItems, selectedMonth)
  const monthlyLabel = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
    .format(new Date(`${selectedMonth}-01T12:00:00`))
  const datedMonths = collectionItems.flatMap((item) => [item.start_date, item.end_date])
    .filter(Boolean)
    .map((date) => date.slice(0, 7))
  const earliestMonth = datedMonths.length ? datedMonths.reduce((earliest, month) => month < earliest ? month : earliest) : currentMonth
  const hasPreviousMonth = selectedMonth > earliestMonth
  const hasNextMonth = selectedMonth < currentMonth

  function changeMonth(offset) {
    setSelectedMonth((month) => {
      const [year, value] = month.split('-').map(Number)
      const next = new Date(year, value - 1 + offset, 1)
      return getCurrentMonth(next)
    })
  }

  return (
    <>
      <div className="stats-bar">
        <div className="stat"><div className="stat-num">{counts.tumu}</div><div className="stat-label">Toplam</div></div>
        <div className="stat"><div className="stat-num">{counts.bekliyor}</div><div className="stat-label">{labels.bekliyor}</div></div>
        <div className="stat"><div className="stat-num">{counts.devam}</div><div className="stat-label">{labels.devam}</div></div>
        <div className="stat"><div className="stat-num">{counts.bitti}</div><div className="stat-label">{labels.bitti}</div></div>
      </div>
      <section className="collection-completion" aria-label="Genel koleksiyon tamamlanma oranı">
        <div className="collection-completion-heading">
          <div>
            <h2>Genel koleksiyon</h2>
            <p>{completionLabel}</p>
          </div>
          <strong>{completion.percentage == null || loading || error ? '—' : `%${completion.percentage}`}</strong>
        </div>
        <div
          className="collection-completion-track"
          role="progressbar"
          aria-label="Tamamlanma oranı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion.percentage ?? 0}
          aria-valuetext={completion.percentage == null ? completionLabel : `%${completion.percentage}, ${completionLabel}`}
        >
          <span style={{ width: `${completion.percentage ?? 0}%` }} />
        </div>
        <details className="monthly-completion">
          <summary>
            <span>Aylık etkinlik</span>
            <span className="monthly-completion-summary-counts">
              {loading || error ? '—' : `${monthlyCompletion.started.length} başladı · ${monthlyCompletion.completed.length} tamamlandı`}
            </span>
            <span className="monthly-completion-month">{monthlyLabel}</span>
          </summary>
          <div className="monthly-completion-details">
            <div className="monthly-completion-controls" aria-label="Etkinlik ayı seçimi">
              <button type="button" aria-label="Önceki ay" disabled={!hasPreviousMonth} onClick={() => changeMonth(-1)}>‹</button>
              <input type="month" aria-label="Etkinlik ayı" min={earliestMonth} max={currentMonth} value={selectedMonth} onChange={(event) => {
                if (event.target.value) setSelectedMonth(event.target.value)
              }} />
              <button type="button" aria-label="Sonraki ay" disabled={!hasNextMonth} onClick={() => changeMonth(1)}>›</button>
            </div>
            <div className="monthly-activity-grid">
              <MonthlyActivityList title="Bu ay başladıklarım" items={monthlyCompletion.started} dateField="start_date" loading={loading} error={error} />
              <MonthlyActivityList title="Bu ay bitirdiklerim" items={monthlyCompletion.completed} dateField="end_date" showRating loading={loading} error={error} />
            </div>
            {!loading && !error && <p className="monthly-completion-note">Başlangıç ve bitiş tarihleri ayın listelerini belirler. Tarih girilmemiş içerikler gösterilmez.</p>}
          </div>
        </details>
      </section>
    </>
  )
}
