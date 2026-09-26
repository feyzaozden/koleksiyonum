function compareDates(a, b, direction) {
  const aDate = a.end_date || a.start_date
  const bDate = b.end_date || b.start_date
  // Dated entries always precede undated entries, in either direction.
  if (Boolean(aDate) !== Boolean(bDate)) return aDate ? -1 : 1
  const dateDifference = aDate ? new Date(aDate) - new Date(bDate) : 0
  return direction * (dateDifference || (new Date(a.added_at) - new Date(b.added_at)))
}

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
  if (sort === 'newest') copy.sort((a, b) => compareDates(a, b, -1))
  else if (sort === 'oldest') copy.sort((a, b) => compareDates(a, b, 1))
  else if (sort === 'az') copy.sort((a, b) => a.title.localeCompare(b.title, 'tr'))
  else if (sort === 'za') copy.sort((a, b) => b.title.localeCompare(a.title, 'tr'))
  else if (sort === 'rating_high') copy.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else if (sort === 'rating_low') copy.sort((a, b) => (a.rating || 0) - (b.rating || 0))
  return copy
}
