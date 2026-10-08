import type { CatalogAuth, ToolCatalogEntry } from './types'

/**
 * API Atlas (https://www.atlasapi.space) — public REST catalog, no account,
 * no key. Observed behavior (verified live):
 * - GET /api/v1/catalog?limit=N            → { entries, nextCursor, total }
 * - Filters honored server-side: type=api|mcp, auth=None|...
 * - `search=` is NOT honored server-side → filter locally after fetching.
 * - `cursor` is a base64 offset ("Mg==" = page 2). Loop until it repeats.
 * - Entry fields: id, slug, name, tagline, category, type, auth, pricing,
 *   popularity (0..100), baseUrl (nullable), description, docsUrl,
 *   cors ("Yes"|null), tags (nullable), freeTier, githubUrl.
 * Secondary sources (used to complete/verify, not duplicated here):
 * - Public APIs teaser API, APIs.guru v2 list.json, public-api-lists repo,
 *   official MCP registry — see docs wiring in POST /api/tools/sync.
 */

const ATLAS_BASE = 'https://www.atlasapi.space/api/v1/catalog'
const ATLAS_UA = { 'User-Agent': 'Nelth-Agent-Catalog-Sync/1.0' }

export type AtlasType = 'api' | 'mcp'

type AtlasEntry = {
  id?: string
  slug?: string
  name?: string
  tagline?: string
  category?: string
  type?: string
  auth?: string
  pricing?: string
  popularity?: number
  baseUrl?: string | null
  description?: string
  docsUrl?: string | null
  cors?: string | null
  tags?: string[] | null
  freeTier?: string | null
  githubUrl?: string | null
}

type AtlasPage = {
  entries?: AtlasEntry[]
  nextCursor?: string | null
}

function normalizeAuth(raw: string | undefined): CatalogAuth {
  const v = (raw ?? '').toLowerCase()
  if (v === 'none' || v === 'no' || v === 'no auth' || v === '') return 'none'
  if (v.includes('oauth')) return 'oauth'
  if (v.includes('bearer')) return 'bearer'
  if (v.includes('key')) return 'api_key'
  return 'unknown'
}

function isHttps(url: string | null | undefined): boolean {
  return !!url && url.toLowerCase().startsWith('https://')
}

export function normalizeAtlasEntry(raw: AtlasEntry, now: string): ToolCatalogEntry | null {
  if (!raw.id || !raw.name) return null
  const isMcp = raw.type === 'mcp'
  const auth = normalizeAuth(raw.auth)
  const free = (raw.pricing ?? '').toLowerCase().startsWith('free')
  const https =
    isHttps(raw.baseUrl) ||
    isHttps(raw.docsUrl) ||
    isHttps(raw.githubUrl)
  const reliability =
    typeof raw.popularity === 'number'
      ? Math.max(0, Math.min(1, raw.popularity / 100))
      : 0.5
  const capabilities = [
    ...(raw.tags ?? []),
    raw.category ?? ''
  ]
    .map(s => s.toLowerCase().trim())
    .filter(Boolean)
  return {
    id: `atlas:${raw.id}`,
    name: raw.name.trim().slice(0, 120),
    description: (raw.description || raw.tagline || '').trim().slice(0, 600),
    category: (raw.category || 'Uncategorized').trim().slice(0, 80),
    source: 'atlas',
    type: isMcp ? 'mcp' : raw.docsUrl?.includes('apis.guru') ? 'openapi' : 'rest',
    endpoint: raw.baseUrl ?? undefined,
    documentationUrl: raw.docsUrl ?? undefined,
    repository: raw.githubUrl ?? undefined,
    transport: isMcp ? 'unknown' : undefined,
    auth,
    free,
    verified: false,
    https,
    cors: raw.cors === 'Yes' ? true : undefined,
    // MCP servers need a host process → not Vercel-executable as-is.
    vercelCompatible: isMcp ? false : https && auth === 'none' ? true : undefined,
    capabilities,
    keywords: [],
    rateLimit: raw.freeTier ?? undefined,
    reliability,
    lastChecked: now
  }
}

export async function fetchAtlasPage(
  type: AtlasType,
  cursor: string | null,
  limit: number,
  auth?: string
): Promise<{ entries: ToolCatalogEntry[]; nextCursor: string | null }> {
  const now = new Date().toISOString()
  const params = new URLSearchParams({
    type,
    limit: String(Math.max(1, Math.min(500, limit)))
  })
  if (cursor) params.set('cursor', cursor)
  if (auth) params.set('auth', auth)
  const response = await fetch(`${ATLAS_BASE}?${params.toString()}`, {
    headers: ATLAS_UA,
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`Atlas HTTP ${response.status}`)
  const page = (await response.json()) as AtlasPage
  const entries: ToolCatalogEntry[] = []
  for (const raw of page.entries ?? []) {
    const entry = normalizeAtlasEntry(raw, now)
    if (entry) entries.push(entry)
  }
  return { entries, nextCursor: page.nextCursor ?? null }
}

/**
 * Bounded full-sync helper: loops pages until the cursor repeats/empties or
 * the page cap is hit (Vercel-safe: call repeatedly with the returned cursor).
 */
export async function fetchAtlasType(
  type: AtlasType,
  opts: { startCursor?: string | null; maxPages?: number; limit?: number; auth?: string } = {}
): Promise<{ entries: ToolCatalogEntry[]; nextCursor: string | null; done: boolean; failed: number }> {
  const maxPages = opts.maxPages ?? 10
  const limit = opts.limit ?? 200
  let cursor: string | null = opts.startCursor ?? null
  const entries: ToolCatalogEntry[] = []
  let failed = 0
  for (let page = 0; page < maxPages; page++) {
    let result: { entries: ToolCatalogEntry[]; nextCursor: string | null }
    try {
      result = await fetchAtlasPage(type, cursor, limit, opts.auth)
    } catch {
      failed++
      break
    }
    entries.push(...result.entries)
    if (!result.nextCursor || result.nextCursor === cursor) {
      return { entries, nextCursor: null, done: true, failed }
    }
    cursor = result.nextCursor
  }
  return { entries, nextCursor: cursor, done: false, failed }
}
