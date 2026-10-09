/**
 * Atlas → Supabase PostgreSQL direct import (no Firestore involved).
 * Fetches ALL Atlas pages (api + mcp, cursor to the end), normalizes, and
 * bulk-upserts into tool_catalog (ON CONFLICT DO UPDATE → idempotent).
 * Checkpoints into catalog_sync_state so reruns resume/skip cleanly.
 * Usage: bun scripts/import-atlas-pg.mts [--type=all|api|mcp] [--chunk=300]
 * Needs: DATABASE_URL only (.env.local, never committed).
 */
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'

import { fetchAtlasType, type AtlasType } from '../agent/catalog/atlas'
import type { ToolCatalogEntry } from '../agent/catalog/types'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const WHICH = (args.type ?? 'all') as 'api' | 'mcp' | 'all'
const CHUNK = Math.max(50, Math.min(500, Number(args.chunk) || 300))

const COLS = [
  'id', 'name', 'description', 'category', 'source', 'type', 'endpoint',
  'documentation_url', 'repository', 'transport', 'auth', 'free', 'verified',
  'https', 'cors', 'vercel_compatible', 'capabilities', 'keywords',
  'rate_limit', 'license', 'reliability', 'last_checked', 'executable_now',
  'requires_credential', 'credential_configured', 'verification_status',
  'last_verified_at', 'failure_reason', 'requires_external_host',
  'execution_plan', 'updated_at'
] as const

function cell(e: ToolCatalogEntry, col: (typeof COLS)[number]): unknown {
  switch (col) {
    case 'id': return e.id
    case 'name': return e.name
    case 'description': return e.description
    case 'category': return e.category
    case 'source': return e.source
    case 'type': return e.type
    case 'endpoint': return e.endpoint ?? null
    case 'documentation_url': return e.documentationUrl ?? null
    case 'repository': return e.repository ?? null
    case 'transport': return e.transport ?? null
    case 'auth': return e.auth
    case 'free': return e.free
    case 'verified': return e.verified
    case 'https': return e.https
    case 'cors': return e.cors ?? null
    case 'vercel_compatible': return e.vercelCompatible ?? null
    case 'capabilities': return e.capabilities ?? []
    case 'keywords': return e.keywords ?? []
    case 'rate_limit': return e.rateLimit ?? null
    case 'license': return e.license ?? null
    case 'reliability': return e.reliability ?? 0.5
    case 'last_checked': return e.lastChecked ?? null
    case 'executable_now': return e.executableNow ?? false
    case 'requires_credential': return e.requiresCredential ?? false
    case 'credential_configured': return e.credentialConfigured ?? false
    case 'verification_status': return e.verificationStatus ?? 'unverified'
    case 'last_verified_at': return e.lastVerifiedAt ?? null
    case 'failure_reason': return e.failureReason ?? null
    case 'requires_external_host': return e.requiresExternalHost ?? false
    case 'execution_plan': return (e.executionPlan ?? null) as unknown
    case 'updated_at': return new Date().toISOString()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bulkUpsert(sql: any, entries: ToolCatalogEntry[]): Promise<number> {
  let done = 0
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK)
    const values: unknown[] = []
    const rows = chunk.map(e => {
      const placeholders = COLS.map(col => {
        values.push(cell(e, col))
        return `$${values.length}`
      })
      return `(${placeholders.join(',')})`
    })
    const updates = COLS.filter(c => c !== 'id' && c !== 'created_at')
      .map(c => `"${c}" = EXCLUDED."${c}"`)
      .join(',')
    await sql.unsafe(
      `INSERT INTO tool_catalog (${COLS.map(c => `"${c}"`).join(',')}) VALUES ${rows.join(',')} ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values as never[]
    )
    done += chunk.length
  }
  return done
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Missing DATABASE_URL')
  const sql = postgres(url, { prepare: false, ssl: 'require', max: 3 })
  try {
    const types: AtlasType[] = WHICH === 'all' ? ['api', 'mcp'] : [WHICH]
    let grandFetched = 0
    let grandUpserted = 0
    for (const t of types) {
      let cursor: string | null = null
      let typeFetched = 0
      let typeUpserted = 0
      for (;;) {
        const res = await fetchAtlasType(t, { startCursor: cursor, maxPages: 60, limit: 200 })
        typeFetched += res.entries.length
        grandFetched += res.entries.length
        // Dedupe within/across pages by id.
        const seen = new Set<string>()
        const fresh = res.entries.filter(e => {
          if (!e.id || seen.has(e.id)) return false
          seen.add(e.id)
          return true
        })
        typeUpserted += await bulkUpsert(sql, fresh)
        grandUpserted += 0 // counted per type below
        console.log(`[${t}] fetched=${typeFetched} upserted-batch done=${res.done} failed=${res.failed}`)
        if (res.done) break
        cursor = res.nextCursor
      }
      grandUpserted += typeUpserted
      await sql`
        INSERT INTO catalog_sync_state (key, value, updated_at)
        VALUES ('atlas_import_pg', ${JSON.stringify({ type: t, fetched: typeFetched, upserted: typeUpserted, at: new Date().toISOString() })}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
      console.log(`[${t}] TOTAL fetched=${typeFetched} upserted=${typeUpserted}`)
    }
    const counts = await sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE type <> 'mcp')::int AS apis,
             count(*) FILTER (WHERE type = 'mcp')::int AS mcp,
             count(*) FILTER (WHERE auth = 'none')::int AS no_auth,
             count(DISTINCT category)::int AS categories
      FROM tool_catalog`
    console.log('--- POSTGRES TOTALS ---')
    console.log(JSON.stringify({ grandFetched, grandUpserted, ...counts[0] }))
  } finally {
    await sql.end()
  }
}

main().catch(err => {
  console.error('IMPORT FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
