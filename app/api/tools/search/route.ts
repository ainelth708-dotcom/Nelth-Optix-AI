import { readMeta } from '@/agent/catalog/store'
import { searchCatalogEntries } from '@/agent/catalog/store'

export const maxDuration = 60

/**
 * GET /api/tools/search?q=&type=&auth=&free=&verified=&vercelCompatible=&category=&limit=
 * Public read-only discovery over the Tool Catalog (real indexed entries,
 * never hard-coded). Powers the /tools dashboard and debugging.
 * Backend-aware: Supabase uses indexed SQL pre-filtering; otherwise the
 * shared cached index is searched. Never loads 10k rows into the model.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    const q = (params.get('q') ?? '').slice(0, 200)
    const type = params.get('type')
    const auth = params.get('auth')
    const limit = Math.max(1, Math.min(100, Number(params.get('limit') ?? 20) || 20))
    const entries = await searchCatalogEntries(q, {
      type: type === 'rest' || type === 'openapi' || type === 'mcp' ? type : 'all',
      auth: auth === 'none' ? 'none' : 'any',
      free: params.get('free') === 'true' ? true : undefined,
      verified: params.get('verified') === 'true' ? true : undefined,
      vercelCompatible:
        params.get('vercelCompatible') === 'true' ? true : undefined,
      category: params.get('category') ?? undefined,
      limit
    })
    const { lastSync } = await readMeta()
    return Response.json({
      query: q,
      count: entries.length,
      backend: process.env.CATALOG_DB_BACKEND === 'supabase' ? 'supabase' : 'firestore',
      lastSync,
      tools: entries
    })
  } catch (error) {
    console.error('Tools search API error:', error)
    return Response.json({ error: 'Search unavailable' }, { status: 500 })
  }
}
