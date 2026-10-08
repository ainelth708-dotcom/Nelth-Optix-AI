import { computeExtendedStats, getCatalog } from '@/agent/catalog/store'

export const maxDuration = 60

/**
 * GET /api/tools/stats — REAL catalog numbers (computed from the stored
 * catalog, never hard-coded): total, APIs, MCP, free, no-auth, verified,
 * executable, categories, last sync, data source.
 */
export async function GET() {
  try {
    const { entries, source, lastSync } = await getCatalog()
    return Response.json(computeExtendedStats(entries, lastSync, source))
  } catch (error) {
    console.error('Tools stats API error:', error)
    return Response.json({ error: 'Stats unavailable' }, { status: 500 })
  }
}
