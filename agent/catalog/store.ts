import type { CatalogBackend } from './backend'
import { firestoreBackend } from './firestore'
import { buildIndex, searchIndex, type IndexedEntry } from './index'
import { SEED_ALL } from './seed'
import { supabaseBackend } from './supabase'
import type {
  CatalogStats,
  ExtendedStats,
  ToolCatalogEntry,
  VerificationStatus
} from './types'

/**
 * Store facade: the ONLY module routes and the agent import for catalog
 * persistence. Backend selection via CATALOG_DB_BACKEND=firestore|supabase
 * (default firestore = rollback-safe). Seed is always merged as the
 * executable layer; memory TTL cache keeps hot paths cheap.
 */

const CACHE_TTL_MS = 10 * 60 * 1000

export type CatalogSource = 'firestore' | 'supabase' | 'seed'

type CacheShape = {
  at: number
  entries: ToolCatalogEntry[]
  index: IndexedEntry[]
  source: CatalogSource
}

const globals = globalThis as unknown as {
  __nelthCatalogCache?: CacheShape
  __nelthCatalogBackend?: string
}

function backendName(): 'firestore' | 'supabase' {
  return process.env.CATALOG_DB_BACKEND === 'supabase' ? 'supabase' : 'firestore'
}

export function getBackend(): CatalogBackend {
  return backendName() === 'supabase' ? supabaseBackend : firestoreBackend
}

export function invalidateCatalogCache(): void {
  globals.__nelthCatalogCache = undefined
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
  const result = await getBackend()
    .saveEntries(entries)
    .catch(() => ({ upserted: 0, duplicatesSkipped: 0 }))
  invalidateCatalogCache()
  return result
}

export async function loadAllEntries(): Promise<ToolCatalogEntry[]> {
  return getBackend().loadAllEntries().catch(() => [] as ToolCatalogEntry[])
}

export async function readMeta(): Promise<{ lastSync: string | null }> {
  return getBackend().readMeta().catch(() => ({ lastSync: null }))
}

export async function writeMeta(lastSync: string): Promise<void> {
  await getBackend().writeMeta(lastSync).catch(() => undefined)
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
  await getBackend().updateVerification(entryId, fields).catch(() => undefined)
  invalidateCatalogCache()
}

export function computeStats(
  entries: ToolCatalogEntry[],
  lastSync: string | null,
  source: CatalogSource
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
  source: CatalogSource
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

export async function refreshLiveIndex(): Promise<{ kept: number }> {
  const result = await getBackend()
    .refreshLiveIndex()
    .catch(() => ({ kept: 0 }))
  invalidateCatalogCache()
  return result
}

export async function getLiveCatalog(): Promise<{
  entries: ToolCatalogEntry[]
  index: IndexedEntry[]
  source: CatalogSource
}> {
  const cached = globals.__nelthCatalogCache
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { entries: cached.entries, index: cached.index, source: cached.source }
  }
  try {
    const live = await getBackend().readLiveIndex()
    if (live?.length) {
      const merged = dedupe([...SEED_ALL, ...live])
      const index = buildIndex(merged)
      const source: CatalogSource = getBackend().name
      globals.__nelthCatalogCache = { at: Date.now(), entries: merged, index, source }
      return { entries: merged, index, source }
    }
  } catch {
    // Fall through to seed (covers unconfigured backends + quota issues).
  }
  const index = buildIndex(SEED_ALL)
  globals.__nelthCatalogCache = { at: Date.now(), entries: SEED_ALL, index, source: 'seed' }
  return { entries: SEED_ALL, index, source: 'seed' }
}

export async function getCatalog(): Promise<{
  entries: ToolCatalogEntry[]
  index: IndexedEntry[]
  source: CatalogSource
  lastSync: string | null
}> {
  const cached = globals.__nelthCatalogCache
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const { lastSync } = await readMeta()
    return { entries: cached.entries, index: cached.index, source: cached.source, lastSync }
  }
  const backend = getBackend()
  const [stored, { lastSync }] = await Promise.all([
    backend.loadAllEntries().catch(() => [] as ToolCatalogEntry[]),
    backend.readMeta().catch(() => ({ lastSync: null as string | null }))
  ])
  const merged = dedupe([...SEED_ALL, ...stored])
  const source: CatalogSource = stored.length > 0 ? backend.name : 'seed'
  const index = buildIndex(merged)
  globals.__nelthCatalogCache = { at: Date.now(), entries: merged, index, source }
  return { entries: merged, index, source, lastSync }
}

export async function searchCatalogEntries(
  query: string,
  filters: {
    type?: 'rest' | 'openapi' | 'mcp' | 'all'
    auth?: 'none' | 'any'
    free?: boolean
    verified?: boolean
    vercelCompatible?: boolean
    category?: string
    limit?: number
  }
): Promise<ToolCatalogEntry[]> {
  const backend = getBackend()
  if (backend.name === 'supabase') {
    try {
      return await backend.searchEntries(query, filters)
    } catch {
      // fall through to cached-index search
    }
  }
  const { index } = await getCatalog()
  return searchIndex(index, query, filters).map(s => s.entry)
}
