// Reload the visible range from the start, including a newly submitted comment.
// Keeping pages contiguous prevents skipping older comments on the next page.
export async function refreshCommentPages(fetchPage, loadedCursor = 0, targetId = null) {
  let cursor = 0
  const entries = []
  let foundTarget = targetId == null
  for (;;) {
    const result = await fetchPage(cursor)
    if (result.error) return result
    const page = result.data
    entries.push(...page.entries)
    foundTarget ||= page.entries.some(entry => String(entry.id) === String(targetId))
    const next = page.next_after ?? page.entries.at(-1)?.id ?? cursor
    if (!page.has_more || (BigInt(next) >= BigInt(loadedCursor) && foundTarget)) {
      return { data: { ...page, entries, next_after: next }, error: null }
    }
    if (BigInt(next) <= BigInt(cursor)) throw new Error('Yorumlar yenilenemedi. Tekrar dene.')
    cursor = next
  }
}
