import { getDb } from '@/lib/firebase/admin'

import { buildIndex, type IndexedEntry } from './index'
import { SEED_ALL } from './seed'
import type {
  CatalogStats,
  ExtendedStats,
  ToolCatalogEntry,
  VerificationStatus
} from './types'

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

export async function updateVerification(
  entryId: string,
  fields: {
    verificationStatus: VerificationStatus
    executableNow?: boolean
    requiresCredential?: boolean
    requiresExternalHost?: boolean
    failureReason?: string
  }
): Promise<void> {
  const db = dbOrNull()
  if (!db) return
  await db
    .collection(COLLECTION)
    .doc(entryId)
    .set(
      {
        ...fields,
        lastVerifiedAt: new Date().toISOString(),
        lastChecked: new Date().toISOString()
      },
      { merge: true }
    )
  globals.__nelthCatalogCache = undefined
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

export function computeExtendedStats(
  entries: ToolCatalogEntry[],
  lastSync: string | null,
  source: 'firestore' | 'seed'
): ExtendedStats {
  const base = computeStats(entries, lastSync, source)
  const isMcp = (e: ToolCatalogEntry) => e.type === 'mcp'
  return {
    ...base,
    executableNow: entries.filter(e => e.executableNow === true).length,
    requiresAuth: entries.filter(e => e.auth !== 'none').length,
    dead: entries.filter(e => e.verificationStatus === 'dead').length,
    unverified: entries.filter(
      e => !e.verificationStatus || e.verificationStatus === 'unverified'
    ).length,
    mcpExecutable: entries.filter(e => isMcp(e) && e.executableNow === true).length,
    mcpRequiresExternalHost: entries.filter(
      e => isMcp(e) && e.requiresExternalHost !== false
    ).length,
    testedOk: entries.filter(e => e.verificationStatus === 'verified').length
  }
}

/**
 * Quota-safe live index (§10): ONE small doc holding the entries the agent
 * actually needs (verified/executable + top no-auth by reliability). The
 * agent hot path reads this single doc instead of scanning 10k+ docs.
 * Refreshed by sync/verify jobs, never per request.
 */
const LIVE_COLLECTION = 'tool_catalog_live'
const LIVE_DOC = 'index'
const LIVE_TOP_N = 400

export async function refreshLiveIndex(): Promise<{ kept: number }> {
  const db = dbOrNull()
  if (!db) return { kept: 0 }
  const snap = await db.collection(COLLECTION).get()
  const all: ToolCatalogEntry[] = []
  snap.forEach(d => all.push({ ...(d.data() as ToolCatalogEntry), id: d.id }))
  const priority = all
    .filter(e => e.type !== 'mcp')
    .sort((a, b) => {
      const rank = (e: ToolCatalogEntry) =>
        (e.executableNow === true ? 100 : 0) +
        (e.verificationStatus === 'verified' ? 50 : 0) +
        (e.free && e.auth === 'none' ? 10 : 0) +
        (e.reliability ?? 0.5)
      return rank(b) - rank(a)
    })
    .slice(0, LIVE_TOP_N)
  const clean = JSON.parse(JSON.stringify(priority)) as ToolCatalogEntry[]
  await db.collection(LIVE_COLLECTION).doc(LIVE_DOC).set(
    { updatedAt: new Date().toISOString(), entries: clean },
    { merge: false }
  )
  globals.__nelthCatalogCache = undefined
  return { kept: clean.length }
}

export async function getLiveCatalog(): Promise<{
  entries: ToolCatalogEntry[]
  index: IndexedEntry[]
  source: 'firestore' | 'seed'
}> {
  const cached = globals.__nelthCatalogCache
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { entries: cached.entries, index: cached.index, source: cached.source }
  }
  try {
    const db = dbOrNull()
    if (db) {
      const snap = await db.collection(LIVE_COLLECTION).doc(LIVE_DOC).get()
      const data = snap.data() as { entries?: ToolCatalogEntry[] } | undefined
      if (data?.entries?.length) {
        const merged = dedupe([...SEED_ALL, ...data.entries])
        const index = buildIndex(merged)
        globals.__nelthCatalogCache = { at: Date.now(), entries: merged, index, source: 'firestore' }
        return { entries: merged, index, source: 'firestore' as const }
      }
    }
  } catch {
    // Fall through to seed (also covers quota exhaustion).
  }
  const index = buildIndex(SEED_ALL)
  globals.__nelthCatalogCache = { at: Date.now(), entries: SEED_ALL, index, source: 'seed' }
  return { entries: SEED_ALL, index, source: 'seed' }
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
