export default function StatsBar({ items, labels }) {
  const counts = {
    tumu: items.length,
    bekliyor: items.filter((i) => i.status === 'bekliyor').length,
    devam: items.filter((i) => i.status === 'devam').length,
    bitti: items.filter((i) => i.status === 'bitti').length,
  }
  return (
    <div className="stats-bar">
      <div className="stat"><div className="stat-num">{counts.tumu}</div><div className="stat-label">Toplam</div></div>
      <div className="stat"><div className="stat-num">{counts.bekliyor}</div><div className="stat-label">{labels.bekliyor}</div></div>
      <div className="stat"><div className="stat-num">{counts.devam}</div><div className="stat-label">{labels.devam}</div></div>
      <div className="stat"><div className="stat-num">{counts.bitti}</div><div className="stat-label">{labels.bitti}</div></div>
    </div>
  )
}
