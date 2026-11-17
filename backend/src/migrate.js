import pg from 'pg'
import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const client = new pg.Client()
try {
  await client.connect()
  await client.query("SELECT pg_advisory_lock(761116)")
  await client.query('CREATE SCHEMA IF NOT EXISTS backend_meta')
  await client.query('REVOKE ALL ON SCHEMA backend_meta FROM PUBLIC')
  await client.query('CREATE TABLE IF NOT EXISTS backend_meta.migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())')
  const directory = new URL('../migrations/', import.meta.url)
  const files = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()
  for (const name of files) {
    const sql = await readFile(new URL(name, directory), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const existing = await client.query('SELECT checksum FROM backend_meta.migrations WHERE name=$1', [name])
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) throw new Error('Applied migration changed; create a new migration')
      console.log(`Already applied: ${name}`); continue
    }
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO backend_meta.migrations(name,checksum) VALUES($1,$2)', [name,checksum])
      await client.query('COMMIT')
      console.log(`Applied: ${name}`)
    } catch (error) { await client.query('ROLLBACK'); throw error }
  }
} catch (error) {
  console.error('Migration failed; transaction rolled back. Code:', error.code || 'migration_error')
  process.exitCode = 1
} finally { await client.end() }
