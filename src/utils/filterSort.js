export function filterAndSortItems(items, { category, statusFilter, search, sort }) {
  let arr = items.filter((i) => i.category === category)
  if (statusFilter !== 'tumu') arr = arr.filter((i) => i.status === statusFilter)
  const q = search.trim().toLowerCase()
  if (q) {
    arr = arr.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.creator && i.creator.toLowerCase().includes(q)) ||
        (i.note && i.note.toLowerCase().includes(q)),
    )
  }
  const copy = [...arr]
  if (sort === 'newest') copy.sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
  else if (sort === 'oldest') copy.sort((a, b) => new Date(a.added_at) - new Date(b.added_at))
  else if (sort === 'az') copy.sort((a, b) => a.title.localeCompare(b.title, 'tr'))
  else if (sort === 'za') copy.sort((a, b) => b.title.localeCompare(a.title, 'tr'))
  else if (sort === 'rating_high') copy.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else if (sort === 'rating_low') copy.sort((a, b) => (a.rating || 0) - (b.rating || 0))
  return copy
}
