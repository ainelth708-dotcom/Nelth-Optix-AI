/**
 * Quota-independent proof of generic execution (§11):
 * Atlas pages → spec-backed no-auth candidates → REAL spec load →
 * operation match → REAL zero-param GET execution. Prints exact outcomes.
 * No Firestore touched (quota-safe). Marking happens via verify-catalog.mts
 * after the quota resets.
 * Usage: bun scripts/prove-dynamic.mts [--pages=12] [--need=5]
 */
import {
  createOpenApiTool,
  loadOpenApiService,
  matchOperation,
  verifyOpenApiOperation
} from '../agent/catalog/exec'
import { fetchAtlasType } from '../agent/catalog/atlas'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const MAX_PAGES = Math.max(1, Math.min(30, Number(args.pages) || 12))
const NEED = Math.max(1, Math.min(20, Number(args.need) || 5))

async function main(): Promise<void> {
  const fetched = await fetchAtlasType('api', { maxPages: MAX_PAGES, limit: 200 })
  console.log(`atlas pages done=${fetched.done} entries=${fetched.entries.length} failed=${fetched.failed}`)
  const candidates = fetched.entries.filter(
    e =>
      e.auth === 'none' &&
      typeof e.documentationUrl === 'string' &&
      /openapi\.json|apis\.guru|swagger\.json/i.test(e.documentationUrl)
  )
  console.log(`spec-backed no-auth candidates: ${candidates.length}`)

  const proven: string[] = []
  let checked = 0
  for (const entry of candidates) {
    if (proven.length >= NEED) break
    checked++
    const specUrl = entry.documentationUrl as string
    const service = await loadOpenApiService(specUrl)
    if (!service) {
      console.log(`[no-spec] ${entry.name}`)
      continue
    }
    const terms = `${entry.name} ${entry.category} ${(entry.capabilities ?? []).join(' ')}`.split(/\s+/)
    const op = matchOperation(service, terms)
    if (!op) {
      console.log(`[no-op] ${entry.name}`)
      continue
    }
    const outcome = await verifyOpenApiOperation(service, op)
    if (outcome.status !== 'verified') {
      console.log(`[${outcome.status}] ${entry.name} :: ${op.operationId} — ${outcome.reason ?? ''}`)
      continue
    }
    const dynamic = createOpenApiTool(entry, service, op)
    if (!dynamic) {
      console.log(`[no-tool] ${entry.name}`)
      continue
    }
    // Execute for real through the generated tool (empty input → defaults).
    const exec = (dynamic as { execute: (input: Record<string, unknown>) => Promise<unknown> }).execute
    let result: unknown
    try {
      result = await exec({})
    } catch (error) {
      console.log(`[exec-fail] ${entry.name} — ${error instanceof Error ? error.message : 'error'}`)
      continue
    }
    const text = JSON.stringify(result).slice(0, 300)
    proven.push(`${entry.name} :: ${op.operationId} @ ${service.baseUrl}${op.path}`)
    console.log(`[PROVEN] ${entry.name} :: ${op.operationId}`)
    console.log(`  response: ${text}`)
  }
  console.log('--- EXACT OUTCOME ---')
  console.log(JSON.stringify({ pages: MAX_PAGES, candidates: candidates.length, checked, proven: proven.length }, null, 2))
  for (const line of proven) console.log(`  EXECUTABLE: ${line}`)
  if (proven.length < NEED) {
    console.log(`NOTE: only ${proven.length}/${NEED} proven in ${MAX_PAGES} pages — widen --pages to prove more.`)
  }
}

main().catch(err => {
  console.error('PROOF FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
