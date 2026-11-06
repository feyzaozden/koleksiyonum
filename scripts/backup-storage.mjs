import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'

// Read-only remote operations. Never print credentials or file contents.
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!key || !env.VITE_SUPABASE_URL) throw new Error('Supabase server credentials are missing.')
const client = createClient(env.VITE_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const root = path.join(os.homedir(), 'Koleksiyonum-Yedekler', `storage-${stamp}`)
const manifest = { startedAt: new Date().toISOString(), complete: false, buckets: [], files: [] }
await mkdir(root, { recursive: true })
async function saveManifest() {
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2))
}
function localPath(bucket, name) {
  const parts = [bucket, ...name.split('/')]
  if (parts.some(part => !part || part === '.' || part === '..' || /[\\:*?"<>|\x00-\x1f]/.test(part) || /[. ]$/.test(part))) throw new Error('Unsupported storage filename; backup stopped.')
  const result = path.resolve(root, 'files', ...parts)
  if (!result.startsWith(path.resolve(root, 'files') + path.sep)) throw new Error('Invalid storage path.')
  return result
}
async function walk(bucket, prefix = '') {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error('Storage listing failed. Check network and server credentials.')
    for (const entry of data) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name
      // Validate folder names before recursing, as well as downloaded files.
      const target = localPath(bucket, name)
      if (!entry.id) { await walk(bucket, name); continue }
      const { data: blob, error: downloadError } = await client.storage.from(bucket).download(name)
      if (downloadError) throw new Error('Storage download failed. The backup is incomplete.')
      const bytes = Buffer.from(await blob.arrayBuffer())
      if (entry.metadata?.size != null && Number(entry.metadata.size) !== bytes.length) throw new Error('File size changed; repeat the backup.')
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes, { flag: 'wx' })
      manifest.files.push({ bucket, name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), contentType: blob.type, updatedAt: entry.updated_at })
    }
    await saveManifest()
    if (data.length < 100) break
  }
}
try {
  await saveManifest()
  const { data: buckets, error } = await client.storage.listBuckets()
  if (error) throw new Error('Cannot list Storage buckets. Check network and server credentials.')
  manifest.buckets = buckets.map(({ id, name, public: isPublic, file_size_limit, allowed_mime_types }) => ({ id, name, public: isPublic, file_size_limit, allowed_mime_types }))
  for (const bucket of buckets) await walk(bucket.id)
  manifest.complete = true
  manifest.finishedAt = new Date().toISOString()
  await saveManifest()
  console.log(JSON.stringify({ complete: true, buckets: buckets.length, files: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.size, 0), directory: root }))
} catch (error) {
  await saveManifest()
  console.error(error.message)
  console.error('INCOMPLETE backup: ' + root)
  process.exitCode = 1
}
