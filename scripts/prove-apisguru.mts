/**
 * apis.guru sweep (§2, secondary source): the real OpenAPI Directory
 * (2,529 spec'd services). For a bounded set: fetch spec → keep no-auth
 * GET operations (no `security` requirement) → match vs service keywords →
 * REAL zero-param verification + execution. Prints exact outcomes.
 * Usage: bun scripts/prove-apisguru.mts [--specs=150] [--need=8]
 */
import {
  createOpenApiTool,
  loadOpenApiService,
  matchOperation,
  verifyOpenApiOperation,
  type OpenApiService
} from '../agent/catalog/exec'
import type { ToolCatalogEntry } from '../agent/catalog/types'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const MAX_SPECS = Math.max(1, Math.min(400, Number(args.specs) || 150))
const NEED = Math.max(1, Math.min(30, Number(args.need) || 8))
const CONC = 10

type GuruList = Record<
  string,
  { preferred?: string; versions?: Record<string, { swaggerUrl?: string; info?: { title?: string } }> }
>

async function checkService(
  name: string,
  swaggerUrl: string
): Promise<{ proven?: string; detail: string; plan?: ToolCatalogEntry['executionPlan'] }> {
  const service = await loadOpenApiService(swaggerUrl)
  if (!service) return { detail: 'no-spec' }
  const terms = name.replace(/[:.]/g, ' ').split(/\s+/)
  const op = matchOperation(service, terms)
  if (!op) return { detail: 'no-op' }
  const outcome = await verifyOpenApiOperation(service, op)
  if (outcome.status === 'requires_params') {
    return { detail: `requires_params:${op.operationId}` }
  }
  if (outcome.status === 'rate_limited') return { detail: `rate_limited:${op.operationId}` }
  if (outcome.status !== 'verified') {
    const authy = /401|403/.test(outcome.reason ?? '')
    return { detail: `${authy ? 'requires_auth' : outcome.status}:${op.operationId}` }
  }
  const fakeEntry = { id: `guru:${name}`, name, type: 'rest' } as ToolCatalogEntry
  const dynamic = createOpenApiTool(fakeEntry, service, op)
  if (!dynamic) return { detail: 'no-tool' }
  try {
    const exec = (dynamic as { execute: (input: Record<string, unknown>) => Promise<unknown> }).execute
    const result = await exec({})
    const text = JSON.stringify(result).slice(0, 250)
    return {
      proven: `${name} :: ${op.operationId} @ ${service.baseUrl}${op.path}`,
      detail: `response: ${text}`,
      plan: { specUrl: swaggerUrl, baseUrl: service.baseUrl, operation: op, verifiedAt: new Date().toISOString() }
    }
  } catch {
    return { detail: `exec-fail:${op.operationId}` }
  }
}

async function main(): Promise<void> {
  const res = await fetch('https://api.apis.guru/v2/list.json', {
    headers: { 'User-Agent': 'Nelth-Agent-Catalog-Sync/1.0' },
    signal: AbortSignal.timeout(60_000)
  })
  if (!res.ok) throw new Error(`list.json HTTP ${res.status}`)
  const list = (await res.json()) as GuruList
  const names = Object.keys(list)
  console.log(`apis.guru services: ${names.length}`)
  const queue: Array<{ name: string; url: string; title: string }> = []
  for (const name of names) {
    if (queue.length >= MAX_SPECS) break
    const entry = list[name]
    const preferred = entry?.preferred
    const url = (preferred && entry?.versions?.[preferred]?.swaggerUrl) || ''
    if (!url.startsWith('https://')) continue
    queue.push({ name, url, title: entry?.versions?.[preferred ?? '']?.info?.title ?? name })
  }
  console.log(`specs to check: ${queue.length}`)

  const proven: Array<{ line: string; plan: NonNullable<ToolCatalogEntry['executionPlan']>; name: string; title: string; url: string }> = []
  const tally: Record<string, number> = {}
  for (let i = 0; i < queue.length; i += CONC) {
    if (proven.length >= NEED) break
    const batch = queue.slice(i, i + CONC)
    const out = await Promise.all(
      batch.map(async q => {
        try {
          return await checkService(q.name, q.url)
        } catch {
          return { detail: 'error' }
        }
      })
    )
    out.forEach((r, j) => {
      const key = r.proven ? 'PROVEN' : r.detail.split(':')[0]
      tally[key] = (tally[key] ?? 0) + 1
      if (r.proven && r.plan) {
        proven.push({ line: r.proven, plan: r.plan, name: batch[j]?.name ?? '', title: batch[j]?.title ?? '', url: batch[j]?.url ?? '' })
        console.log(`[PROVEN] ${r.proven}`)
        console.log(`  response: ${r.detail}`)
      }
    })
    console.log(`  ${Math.min(i + CONC, queue.length)}/${queue.length} proven=${proven.length}`)
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync(
    '_guru_proven.json',
    JSON.stringify({ proven, tally, checked: Math.min(queue.length, Math.ceil(queue.length / CONC) * CONC) }, null, 1)
  )
  console.log('--- EXACT OUTCOME ---')
  console.log(JSON.stringify({ services: names.length, specsChecked: queue.length, proven: proven.length, tally }, null, 2))
}

main().catch(err => {
  console.error('PROOF FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
