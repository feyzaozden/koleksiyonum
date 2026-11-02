// Per loaded document, not per route, refresh token, or React mount.
let documentId
export function createSiteOpenReporter(client) {
  documentId ||= crypto.randomUUID()
  const type = performance.getEntriesByType('navigation')[0]?.type
  const navigationKind = ['reload', 'back_forward'].includes(type) ? type : 'navigate'
  let recorded = false
  return async () => {
    if (recorded) return
    const result = await client.rpc('record_site_open', { document_id: documentId, navigation_kind: navigationKind })
    if (!result.error) recorded = true
    return result
  }
}
