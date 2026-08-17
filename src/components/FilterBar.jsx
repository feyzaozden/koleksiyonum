const STATUS_FILTERS = [
  { value: 'tumu', label: 'Tümü' },
  { value: 'bekliyor', label: '⏳ Bekliyor' },
  { value: 'devam', label: '▶️ Devam' },
  { value: 'bitti', label: '✅ Tamam' },
]

export default function FilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, sort, onSortChange }) {
  return (
    <div className="filter-bar">
      <input type="text" placeholder="Ara..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
      {STATUS_FILTERS.map((f) => (
        <button
          key={f.value}
          className={'filter-btn' + (statusFilter === f.value ? ' active' : '')}
          onClick={() => onStatusFilterChange(f.value)}
        >
          {f.label}
        </button>
      ))}
      <select className="sort-select" value={sort} onChange={(e) => onSortChange(e.target.value)}>
        <option value="newest">En Yeni</option>
        <option value="oldest">En Eski</option>
        <option value="az">A → Z</option>
        <option value="za">Z → A</option>
        <option value="rating_high">⭐ Puan (Yüksek)</option>
        <option value="rating_low">⭐ Puan (Düşük)</option>
      </select>
    </div>
  )
}
