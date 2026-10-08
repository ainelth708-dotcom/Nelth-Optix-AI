import { searchIndex } from '@/agent/catalog/index'
import { getCatalog } from '@/agent/catalog/store'

export const maxDuration = 60

/**
 * GET /api/tools/search?q=&type=&auth=&free=&verified=&vercelCompatible=&category=&limit=
 * Public read-only discovery over the Tool Catalog (real indexed entries,
 * never hard-coded). Powers the /tools dashboard and debugging.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    const q = (params.get('q') ?? '').slice(0, 200)
    const type = params.get('type')
    const auth = params.get('auth')
    const limit = Math.max(1, Math.min(100, Number(params.get('limit') ?? 20) || 20))
    const { index, source, lastSync } = await getCatalog()
    const results = searchIndex(index, q, {
      type: type === 'rest' || type === 'openapi' || type === 'mcp' ? type : type === 'all' || !type ? 'all' : 'all',
      auth: auth === 'none' ? 'none' : 'any',
      free: params.get('free') === 'true' ? true : undefined,
      verified: params.get('verified') === 'true' ? true : undefined,
      vercelCompatible:
        params.get('vercelCompatible') === 'true' ? true : undefined,
      category: params.get('category') ?? undefined,
      limit
    })
    return Response.json({
      query: q,
      count: results.length,
      source,
      lastSync,
      tools: results.map(r => ({ ...r.entry, score: Math.round(r.score * 100) / 100 }))
    })
  } catch (error) {
    console.error('Tools search API error:', error)
    return Response.json({ error: 'Search unavailable' }, { status: 500 })
  }
}
