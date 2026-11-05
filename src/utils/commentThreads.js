export function orderCommentThreads(entries) {
  return [...entries].sort((a, b) => {
    const rootA = BigInt(a.parent_id ?? a.id)
    const rootB = BigInt(b.parent_id ?? b.id)
    if (rootA !== rootB) return rootA < rootB ? -1 : 1
    const idA = BigInt(a.id), idB = BigInt(b.id)
    return idA === idB ? 0 : idA < idB ? -1 : 1
  })
}
