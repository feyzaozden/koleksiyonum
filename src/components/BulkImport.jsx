import { useState } from 'react'
import { parseBulkItems } from '../utils/bulkItems'

export default function BulkImport({ category, disabled, onImport, onComplete }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  async function submit() {
    if (busy) return
    setError('')
    setResults(null)
    setBusy(true)
    try {
      const entries = parseBulkItems(text, category)
      const data = await onImport(entries)
      setResults(data.map((row) => ({ ...row, title: entries[row.row_number - 1]?.title })))
      setText(entries.filter((entry, index) => data.some((row) => row.row_number === index + 1 && row.outcome === 'rejected'))
        .map((entry) => [entry.title, entry.creator || '', entry.year || ''].join(' | ')).join('\n'))
    } catch (e) { setError(e.message || 'Toplu ekleme tamamlanamadı. Koleksiyonunu kontrol edip tekrar dene.') }
    finally { setBusy(false); onComplete() }
  }
  return <details className="bulk-import" onKeyDown={(event) => event.stopPropagation()}>
    <summary>Listeden toplu ekle</summary>
    <label htmlFor="bulk-items">Her satıra bir içerik yaz. İsteğe bağlı olarak | işaretiyle yazar/yönetmen ve yıl ekleyebilirsin.</label>
    <textarea id="bulk-items" rows={5} maxLength={65000} value={text} disabled={busy || disabled} onChange={(e) => setText(e.target.value)} placeholder="Başlık | Yazar veya yönetmen | Yıl" />
    <p className="creation-hint">En fazla 100 satır. Kayıtlar bekleme listene eklenir; mevcut tekrarlar atlanır. Günlük hakkın geçerlidir.</p>
    <button type="button" className="btn-add" disabled={busy || disabled || !text.trim()} onClick={submit}>{busy ? 'Ekleniyor…' : 'Listeyi ekle'}</button>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {results && <div role="status">
      <p>{results.filter((row) => row.outcome === 'added').length} eklendi · {results.filter((row) => row.outcome === 'duplicate').length} zaten mevcut · {results.filter((row) => row.outcome === 'rejected').length} eklenemedi</p>
      <ul>{results.filter((row) => row.outcome !== 'added').map((row) => <li key={row.row_number}>{row.row_number}. {row.title}: {row.message}</li>)}</ul>
    </div>}
  </details>
}
