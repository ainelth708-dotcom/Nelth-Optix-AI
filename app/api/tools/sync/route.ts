import { fetchAtlasType, type AtlasType } from '@/agent/catalog/atlas'
import {
  computeExtendedStats,
  getCatalog,
  readMeta,
  saveEntries,
  writeMeta
} from '@/agent/catalog/store'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 300

/**
 * POST /api/tools/sync — resynchronize the catalog from API Atlas (§18).
 * Authenticated users only (server credentials stay server-side).
 * Bounded per call (Vercel-safe): { type: 'api'|'mcp'|'all', pages, limit,
 * cursors: { api, mcp } }. Repeat with the returned cursors until done.
 * 1. fetch catalog pages → 2. normalize → 3. upsert by id (no duplicates)
 * 4. dead APIs are NOT auto-deleted (conservative) but timestamps update.
 */
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { error: 'Authentication required', authRequired: true },
        { status: 401 }
      )
    }
    const body: unknown = await req.json().catch(() => ({}))
    const raw = (body ?? {}) as {
      type?: unknown
      pages?: unknown
      limit?: unknown
      cursors?: unknown
    }
    const type: 'api' | 'mcp' | 'all' =
      raw.type === 'api' || raw.type === 'mcp' ? raw.type : 'all'
    const pages = Math.max(1, Math.min(25, Number(raw.pages) || 10))
    const limit = Math.max(10, Math.min(500, Number(raw.limit) || 200))
    const cursors = (raw.cursors ?? {}) as { api?: string; mcp?: string }
    const types: AtlasType[] = type === 'all' ? ['api', 'mcp'] : [type]

    let fetched = 0
    let upserted = 0
    let duplicatesSkipped = 0
    let failed = 0
    const nextCursors: { api: string | null; mcp: string | null } = {
      api: null,
      mcp: null
    }
    let done = true
    for (const t of types) {
      const res = await fetchAtlasType(t, {
        startCursor: cursors[t] ?? null,
        maxPages: pages,
        limit
      })
      fetched += res.entries.length
      failed += res.failed
      const saved = await saveEntries(res.entries)
      upserted += saved.upserted
      duplicatesSkipped += saved.duplicatesSkipped
      nextCursors[t] = res.nextCursor
      if (!res.done) done = false
    }
    const now = new Date().toISOString()
    if (done) await writeMeta(now)
    const { entries, source } = await getCatalog()
    const { lastSync } = await readMeta()
    return Response.json({
      fetched,
      upserted,
      duplicatesSkipped,
      failed,
      nextCursors,
      done,
      stats: computeExtendedStats(entries, lastSync, source)
    })
  } catch (error) {
    console.error('Tools sync API error:', error)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
