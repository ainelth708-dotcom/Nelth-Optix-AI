/**
 * Root-probe pass (§4): for every no-auth Atlas API entry WITH an https
 * baseUrl, perform a REAL GET on the root. JSON 200 → candidate executable
 * (generic root operation). Results go to a local JSON file (no Firestore —
 * marking happens after the quota resets). Prints exact counts.
 * Usage: bun scripts/probe-roots.mts [--pages=30] [--concurrency=30]
 */
import { fetchAtlasType } from '../agent/catalog/atlas'
import { safeFetchJson } from '../agent/fetch'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const MAX_PAGES = Math.max(1, Math.min(40, Number(args.pages) || 30))
const CONC = Math.max(1, Math.min(50, Number(args.concurrency) || 30))

type ProbeResult = {
  id: string
  name: string
  baseUrl: string
  status: 'verified' | 'dead' | 'rate_limited' | 'non_json' | 'error'
  http?: number
  ms?: number
  keys?: string[]
  reason?: string
}

async function probe(
  id: string,
  name: string,
  baseUrl: string
): Promise<ProbeResult> {
  let host: string
  try {
    host = new URL(baseUrl).hostname
  } catch {
    return { id, name, baseUrl, status: 'error', reason: 'bad url' }
  }
  const started = Date.now()
  try {
    const data = await safeFetchJson(baseUrl, { allowedHosts: [host], timeoutMs: 12_000 })
    const keys =
      data && typeof data === 'object' && !Array.isArray(data)
        ? Object.keys(data).slice(0, 12)
        : Array.isArray(data)
          ? [`array[${data.length}]`]
          : [typeof data]
    return { id, name, baseUrl, status: 'verified', http: 200, ms: Date.now() - started, keys }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error'
    if (/HTTP 429/.test(message)) return { id, name, baseUrl, status: 'rate_limited', reason: message.slice(0, 120) }
    if (/HTTP \d+/.test(message)) {
      const code = Number((message.match(/HTTP (\d+)/) ?? [])[1] ?? 0)
      return { id, name, baseUrl, status: 'dead', http: code, reason: message.slice(0, 120) }
    }
    return { id, name, baseUrl, status: 'error', reason: message.slice(0, 120) }
  }
}

async function main(): Promise<void> {
  const fetched = await fetchAtlasType('api', { maxPages: MAX_PAGES, limit: 200 })
  const targets = fetched.entries.filter(
    e =>
      e.auth === 'none' &&
      typeof e.endpoint === 'string' &&
      /^https:\/\//i.test(e.endpoint)
  )
  console.log(
    `atlas done=${fetched.done} scanned=${fetched.entries.length} with-https-base=${targets.length}`
  )
  const results: ProbeResult[] = []
  for (let i = 0; i < targets.length; i += CONC) {
    const batch = targets.slice(i, i + CONC)
    const out = await Promise.all(
      batch.map(e => probe(e.id, e.name, e.endpoint as string))
    )
    results.push(...out)
    const ok = results.filter(r => r.status === 'verified').length
    console.log(`  ${Math.min(i + CONC, targets.length)}/${targets.length} verified-so-far=${ok}`)
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync('_rootprobe.json', JSON.stringify(results, null, 1))
  const byStatus = Object.groupBy
    ? Object.groupBy(results, r => r.status)
    : results.reduce<Record<string, ProbeResult[]>>((m, r) => {
        ;(m[r.status] ??= []).push(r)
        return m
      }, {})
  console.log('--- EXACT OUTCOME ---')
  for (const [status, list] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${list.length}`)
  }
  console.log('--- VERIFIED (new executables) ---')
  for (const r of results.filter(r => r.status === 'verified').slice(0, 20)) {
    console.log(`  ${r.name} :: GET ${r.baseUrl} (${r.ms}ms, keys: ${(r.keys ?? []).slice(0, 6).join(',')})`)
  }
}

main().catch(err => {
  console.error('PROBE FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
