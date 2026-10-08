/**
 * One-shot full import of the API Atlas catalog into Firestore.
 * Usage: bun scripts/sync-atlas.mts [--type=api|mcp|all] [--limit=500]
 * Reads credentials from .env + .env.local (FIREBASE_SERVICE_ACCOUNT).
 * Loops cursor pagination to the LAST page for api AND mcp, upserts by id
 * (no duplicates), writes tool_catalog_meta/sync. Prints exact numbers.
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import { fetchAtlasType, type AtlasType } from '../agent/catalog/atlas'
import type { ToolCatalogEntry } from '../agent/catalog/types'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name} (.env.local)`)
  return v
}

async function main(): Promise<void> {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    })
  )
  const which = (args.type ?? 'all') as 'api' | 'mcp' | 'all'
  const limit = Math.max(10, Math.min(500, Number(args.limit) || 500))
  const types: AtlasType[] = which === 'all' ? ['api', 'mcp'] : [which]

  const svc = JSON.parse(
    Buffer.from(mustEnv('FIREBASE_SERVICE_ACCOUNT'), 'base64').toString('utf8')
  ) as { project_id?: string }
  initializeApp({
    credential: cert(svc as never),
    projectId: svc.project_id
  })
  const db = getFirestore()
  console.log(`project=${svc.project_id} type=${which} limit=${limit}`)

  const seen = new Set<string>()
  let grandFetched = 0
  let grandUpserted = 0
  let grandDupes = 0
  let grandFailed = 0
  const perType: Record<string, { pages: number; fetched: number; upserted: number; done: boolean; cursor: string | null }> = {}

  for (const t of types) {
    let cursor: string | null = null
    let pages = 0
    let fetched = 0
    let upserted = 0
    let done = false
    for (;;) {
      const res = await fetchAtlasType(t, {
        startCursor: cursor,
        maxPages: 50,
        limit
      })
      pages += 1
      fetched += res.entries.length
      grandFetched += res.entries.length
      grandFailed += res.failed
      // Dedupe across pages (cursor overlap safety) then upsert.
      const fresh = res.entries.filter(e => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      grandDupes += res.entries.length - fresh.length
      for (let i = 0; i < fresh.length; i += 400) {
        const batch = db.batch()
        for (const e of fresh.slice(i, i + 400)) {
          // Strip undefined (Firestore rejects them; admin runtime uses
          // ignoreUndefinedProperties, this script sanitizes explicitly).
          const clean = JSON.parse(JSON.stringify(e)) as Record<string, unknown>
          batch.set(db.collection('tool_catalog').doc(e.id), clean, { merge: true })
        }
        await batch.commit()
      }
      upserted += fresh.length
      grandUpserted += fresh.length
      console.log(`[${t}] batch pages=${pages} fetched=${fetched} upserted=${upserted} next=${res.nextCursor ?? 'END'} failed=${res.failed}`)
      if (res.done) {
        done = true
        cursor = null
        break
      }
      cursor = res.nextCursor
    }
    perType[t] = { pages, fetched, upserted, done, cursor }
  }

  // Exact final counts, computed from what WE imported + full collection scan.
  const all: ToolCatalogEntry[] = []
  const snap = await db.collection('tool_catalog').get()
  snap.forEach(d => all.push({ ...d.data(), id: d.id } as ToolCatalogEntry))
  const count = (f: (e: ToolCatalogEntry) => boolean) => all.filter(f).length
  const now = new Date().toISOString()
  await db.collection('tool_catalog_meta').doc('sync').set({ lastSync: now }, { merge: true })

  console.log('--- EXACT NUMBERS (this import) ---')
  console.log(JSON.stringify({ perType, grandFetched, grandUpserted, grandDupes, grandFailed }, null, 2))
  console.log('--- FIRESTORE COLLECTION TOTALS ---')
  console.log(
    JSON.stringify(
      {
        total: all.length,
        apis: count(e => e.type !== 'mcp'),
        mcp: count(e => e.type === 'mcp'),
        free: count(e => e.free),
        noAuth: count(e => e.auth === 'none'),
        verified: count(e => e.verified),
        categories: new Set(all.map(e => e.category)).size,
        lastSync: now
      },
      null,
      2
    )
  )
}

main().catch(err => {
  console.error('SYNC FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
