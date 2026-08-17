import ItemCard from './ItemCard'

const EMPTY_MESSAGES = {
  tumu: (emoji) => ({ icon: emoji, h: 'Koleksiyon boş', p: 'İlk öğeni eklemek için yukarıdaki formu kullan.' }),
  bekliyor: () => ({ icon: '⏳', h: 'Bekleyende yok', p: 'Henüz listeye alınmış bir şey yok.' }),
  devam: () => ({ icon: '▶️', h: 'Devam eden yok', p: 'Şu an devam edilen bir şey yok.' }),
  bitti: () => ({ icon: '✅', h: 'Tamamlanan yok', p: 'Henüz tamamladığın bir şey yok.' }),
}

export default function ItemsGrid({ sections, tabEmoji, activeFilter, labels, onStatusChange, onEdit, onDelete }) {
  const showSectionHeaders = sections.length > 1

  if (!showSectionHeaders) {
    const section = sections[0]
    if (!section || section.items.length === 0) {
      const msg = EMPTY_MESSAGES[activeFilter](tabEmoji)
      return (
        <div className="items-grid">
          <div className="empty">
            <div className="empty-icon">{msg.icon}</div>
            <h3>{msg.h}</h3>
            <p>{msg.p}</p>
          </div>
        </div>
      )
    }
    return (
      <div className="items-grid">
        {section.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isOwner={section.isOwner}
            labels={labels}
            ownerName={section.userName}
            showOwner={false}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="items-grid">
      {sections.map((section) => (
        <div key={section.userId}>
          <div className="section-head">
            <span className="section-head-label">{section.userName}</span>
            <div className="section-head-line" />
          </div>
          {section.items.length === 0 ? (
            <div className="empty" style={{ padding: '18px 0 8px' }}>
              <div className="empty-icon" style={{ fontSize: '1.8rem' }}>{tabEmoji}</div>
              <p>Henüz bir şey yok.</p>
            </div>
          ) : (
            section.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isOwner={section.isOwner}
                labels={labels}
                ownerName={section.userName}
                showOwner={false}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      ))}
    </div>
  )
}
