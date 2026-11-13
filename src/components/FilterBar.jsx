const STATUS_FILTERS = [
  { value: 'tumu', label: 'Tümü' },
  { value: 'bekliyor', label: '⏳ Bekliyor' },
  { value: 'devam', label: '▶️ Devam' },
  { value: 'bitti', label: '✅ Tamam' },
]

export default function FilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, sort, onSortChange, category }) {
  return (
    <div className="filter-bar" role="group" aria-label="Koleksiyon arama ve filtreleri">
      <input type="search" aria-label={category === 'muzik' ? 'Şarkı, sanatçı, albüm veya not ara' : 'Başlık, yazar veya nota göre ara'} placeholder={category === 'muzik' ? 'Şarkı, sanatçı, albüm veya not ara…' : 'Başlık, yazar veya not ara...'} value={search} onChange={(e) => onSearchChange(e.target.value)} />
      {category !== 'muzik' && STATUS_FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          className={'filter-btn' + (statusFilter === f.value ? ' active' : '')}
          aria-pressed={statusFilter === f.value}
          onClick={() => onStatusFilterChange(f.value)}
        >
          {f.label}
        </button>
      ))}
      <select className="sort-select" aria-label="Sıralama ölçütü" value={sort} onChange={(e) => onSortChange(e.target.value)}>
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
