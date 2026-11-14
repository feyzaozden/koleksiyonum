import ItemCard from './ItemCard'
import ProfileItemCard from './ProfileItemCard'
import { useItemReactions } from '../hooks/useItemReactions'
import { useCommentCounts } from '../hooks/useCommentCounts'

const EMPTY_MESSAGES = {
  tumu: (emoji) => ({ icon: emoji, h: 'Koleksiyon boş', p: 'İlk öğeni eklemek için yukarıdaki formu kullan.' }),
  bekliyor: () => ({ icon: '⏳', h: 'Bekleyende yok', p: 'Henüz listeye alınmış bir şey yok.' }),
  devam: () => ({ icon: '▶️', h: 'Devam eden yok', p: 'Şu an devam edilen bir şey yok.' }),
  bitti: () => ({ icon: '✅', h: 'Tamamlanan yok', p: 'Henüz tamamladığın bir şey yok.' }),
}

export default function ItemsGrid({ sections, tabEmoji, activeFilter, labels, search = '', onClearFilters, onStatusChange, onEdit, onDelete, onProgress, onAddToPlaylist, onFeature, compact = false }) {
  const showSectionHeaders = sections.length > 1
  const reactions = useItemReactions(sections.flatMap((section) => section.items.map((item) => item.id)))
  const commentCounts = useCommentCounts(sections.flatMap(section => section.items.map(item => item.id)))
  if (compact) {
    const items = sections.flatMap(section => section.items)
    return items.length ? <div className="profile-item-grid">{items.map(item => <ProfileItemCard key={item.id} item={item} reactions={reactions} commentCount={commentCounts[item.id]} />)}</div>
      : <p className="profile-empty">{search || activeFilter !== 'tumu' ? 'Bu filtrelere uygun içerik bulunamadı.' : 'Henüz içerik yok.'}</p>
  }

  if ((search.trim() || activeFilter !== 'tumu') && sections.every((section) => section.items.length === 0)) {
    return (
      <div className="items-grid">
        <div className="empty">
          <div className="empty-icon">🔎</div>
          <h3>{search.trim() ? 'Aramanla eşleşen içerik bulunamadı' : 'Bu filtreyle eşleşen içerik bulunamadı'}</h3>
          <p>Arama veya durum filtresini temizleyip tekrar deneyebilirsin.</p>
          <button className="btn-cancel empty-clear-filters" type="button" onClick={onClearFilters}>Filtreleri temizle</button>
        </div>
      </div>
    )
  }

  if (!showSectionHeaders) {
    const section = sections[0]
    if (!section || section.items.length === 0) {
      const msg = EMPTY_MESSAGES[activeFilter](tabEmoji)
      return (
        <div className="items-grid">
          <div className="empty">
            <div className="empty-icon">{msg.icon}</div>
            <h3>{msg.h}</h3>
            <p>{section?.isOwner ? msg.p : 'Bu görünümde gösterilecek öğe yok.'}</p>
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
            reactions={reactions}
            commentCount={commentCounts[item.id]}
            isOwner={section.isOwner}
            labels={labels}
            ownerName={section.userName}
            showOwner={false}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
            onProgress={onProgress}
            onAddToPlaylist={onAddToPlaylist}
            onFeature={onFeature}
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
                reactions={reactions}
                commentCount={commentCounts[item.id]}
                isOwner={section.isOwner}
                labels={labels}
                ownerName={section.userName}
                showOwner={false}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
            onProgress={onProgress}
            onAddToPlaylist={onAddToPlaylist}
            onFeature={onFeature}
              />
            ))
          )}
        </div>
      ))}
    </div>
  )
}
