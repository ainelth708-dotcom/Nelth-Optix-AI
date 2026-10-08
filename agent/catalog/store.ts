import { getDb } from '@/lib/firebase/admin'

import { buildIndex, type IndexedEntry } from './index'
import { SEED_ALL } from './seed'
import type { CatalogStats, ToolCatalogEntry } from './types'

/**
 * Cache tiers (§10), compatible Vercel (no daemon, no local files):
 *   Atlas / seed  →  Firestore `tool_catalog` (+ meta doc)  →  memory TTL
 *   →  Tool discovery.
 * Firestore is the project's existing database (chat persistence already
 * uses it) — no new database is created. When Firebase isn't configured
 * (local/dev without credentials), the bundled seed is used and writes are
 * skipped silently.
 */

const COLLECTION = 'tool_catalog'
const META_COLLECTION = 'tool_catalog_meta'
const META_DOC = 'sync'
const CACHE_TTL_MS = 10 * 60 * 1000

type CacheShape = {
  at: number
  entries: ToolCatalogEntry[]
  index: IndexedEntry[]
  source: 'firestore' | 'seed'
}

const globals = globalThis as unknown as { __nelthCatalogCache?: CacheShape }

function dbOrNull(): ReturnType<typeof getDb> | null {
  try {
    return getDb()
  } catch {
    return null
  }
}

function dedupe(entries: ToolCatalogEntry[]): ToolCatalogEntry[] {
  const map = new Map<string, ToolCatalogEntry>()
  for (const entry of entries) {
    if (!entry.id) continue
    map.set(entry.id, entry)
  }
  return [...map.values()]
}

export async function saveEntries(
  entries: ToolCatalogEntry[]
): Promise<{ upserted: number; duplicatesSkipped: number }> {
  const unique = dedupe(entries)
  const duplicatesSkipped = entries.length - unique.length
  const db = dbOrNull()
  if (!db) return { upserted: 0, duplicatesSkipped }
  // Batched writes, 400/batch (under the 500 limit), merge = upsert by id.
  for (let i = 0; i < unique.length; i += 400) {
    const batch = db.batch()
    for (const entry of unique.slice(i, i + 400)) {
      batch.set(db.collection(COLLECTION).doc(entry.id), entry, { merge: true })
    }
    await batch.commit()
  }
  globals.__nelthCatalogCache = undefined
  return { upserted: unique.length, duplicatesSkipped }
}

export async function loadAllEntries(): Promise<ToolCatalogEntry[]> {
  const db = dbOrNull()
  if (!db) return []
  const snap = await db.collection(COLLECTION).get()
  const entries: ToolCatalogEntry[] = []
  snap.forEach(doc => {
    entries.push({ ...(doc.data() as ToolCatalogEntry), id: doc.id })
  })
  return entries
}

export async function readMeta(): Promise<{ lastSync: string | null }> {
  const db = dbOrNull()
  if (!db) return { lastSync: null }
  const snap = await db.collection(META_COLLECTION).doc(META_DOC).get()
  const data = snap.data() as { lastSync?: string } | undefined
  return { lastSync: data?.lastSync ?? null }
}

export async function writeMeta(lastSync: string): Promise<void> {
  const db = dbOrNull()
  if (!db) return
  await db
    .collection(META_COLLECTION)
    .doc(META_DOC)
    .set({ lastSync }, { merge: true })
}

export function computeStats(
  entries: ToolCatalogEntry[],
  lastSync: string | null,
  source: 'firestore' | 'seed'
): CatalogStats {
  const cats = new Set(entries.map(e => e.category))
  return {
    total: entries.length,
    apis: entries.filter(e => e.type !== 'mcp').length,
    mcp: entries.filter(e => e.type === 'mcp').length,
    free: entries.filter(e => e.free).length,
    noAuth: entries.filter(e => e.auth === 'none').length,
    verified: entries.filter(e => e.verified).length,
    executable: entries.filter(e => e.verified && e.type !== 'mcp').length,
    categories: cats.size,
    lastSync,
    source
  }
}

export async function getCatalog(): Promise<{
  entries: ToolCatalogEntry[]
  index: IndexedEntry[]
  source: 'firestore' | 'seed'
  lastSync: string | null
}> {
  const cached = globals.__nelthCatalogCache
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const { lastSync } = await readMeta().catch(() => ({ lastSync: null as string | null }))
    return { entries: cached.entries, index: cached.index, source: cached.source, lastSync }
  }
  const [stored, { lastSync }] = await Promise.all([
    loadAllEntries().catch(() => [] as ToolCatalogEntry[]),
    readMeta().catch(() => ({ lastSync: null as string | null }))
  ])
  const merged = dedupe([...SEED_ALL, ...stored])
  const source: 'firestore' | 'seed' = stored.length > 0 ? 'firestore' : 'seed'
  const index = buildIndex(merged)
  globals.__nelthCatalogCache = { at: Date.now(), entries: merged, index, source }
  return { entries: merged, index, source, lastSync }
}
