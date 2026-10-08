/**
 * Real verification pass over the catalog (§4).
 * Usage: bun scripts/verify-catalog.mts [--limit=40] [--mcp=20]
 * For bounded no-auth API candidates with an OpenAPI spec URL: loads the
 * spec, matches an operation, performs a REAL zero-param GET call. Success →
 * verificationStatus=verified + executableNow=true + stored executionPlan.
 * Anything else records the honest status (requires_params, dead,
 * rate_limited, ...). MCP http candidates get a real handshake probe.
 * Prints exact per-entry outcomes — never fabricated.
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import {
  FieldPath,
  getFirestore,
  type Query as FirestoreQuery
} from 'firebase-admin/firestore'

import {
  loadOpenApiService,
  matchOperation,
  verifyOpenApiOperation
} from '../agent/catalog/exec'
import { classifyMcp, probeMcpHttp } from '../agent/catalog/mcp'
import type { ToolCatalogEntry, VerificationStatus } from '../agent/catalog/types'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const LIMIT = Math.max(1, Math.min(200, Number(args.limit) || 40))
const MCP_LIMIT = Math.max(0, Math.min(100, Number(args.mcp ?? 20) || 20))

async function main(): Promise<void> {
  const svc = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')
  ) as { project_id?: string }
  if (!svc.project_id) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')
  initializeApp({ credential: cert(svc as never), projectId: svc.project_id })
  const db = getFirestore()

  // Paginated scan (quota-safe): page through doc IDs, keep spec-backed
  // no-auth candidates, stop early. Never loads the whole collection.
  const candidates: ToolCatalogEntry[] = []
  let scanned = 0
  let lastId: string | null = null
  const MAX_SCAN = 6000
  for (;;) {
    let query: FirestoreQuery = db
      .collection('tool_catalog')
      .orderBy(FieldPath.documentId())
      .limit(500)
    if (lastId) query = query.startAfter(lastId)
    const snap = await query.get()
    if (snap.empty) break
    snap.forEach(d => {
      const e = { ...d.data(), id: d.id } as ToolCatalogEntry
      scanned++
      lastId = d.id
      if (
        candidates.length < LIMIT &&
        e.type !== 'mcp' &&
        e.auth === 'none' &&
        (!e.verificationStatus || e.verificationStatus === 'unverified') &&
        typeof e.documentationUrl === 'string' &&
        /openapi\.json|apis\.guru|swagger\.json/i.test(e.documentationUrl)
      ) {
        candidates.push(e)
      }
    })
    if (candidates.length >= LIMIT || scanned >= MAX_SCAN) break
  }
  console.log(`scanned=${scanned} spec-backed no-auth candidates=${candidates.length}`)

  let verified = 0
  let dead = 0
  let params = 0
  let other = 0
  const newlyExecutable: string[] = []
  for (const entry of candidates.slice(0, LIMIT)) {
    const specUrl = entry.documentationUrl as string
    let status: VerificationStatus = 'unverified'
    let reason = ''
    let plan: ToolCatalogEntry['executionPlan'] | undefined
    try {
      const service = await loadOpenApiService(specUrl)
      if (!service) {
        status = 'invalid_spec'
        reason = 'spec not parseable'
      } else {
        const terms = `${entry.name} ${entry.category} ${(entry.capabilities ?? []).join(' ')}`
        const op = matchOperation(service, terms.split(/\s+/))
        if (!op) {
          status = 'unverified'
          reason = 'no matching GET operation'
        } else {
          const outcome = await verifyOpenApiOperation(service, op)
          if (outcome.status === 'verified') {
            status = 'verified'
            plan = { specUrl, baseUrl: service.baseUrl, operation: op, verifiedAt: new Date().toISOString() }
          } else if (outcome.status === 'requires_params') {
            status = 'requires_params'
            reason = outcome.reason ?? ''
          } else {
            status = outcome.status
            reason = outcome.reason ?? ''
          }
        }
      }
    } catch (error) {
      status = 'temporarily_unavailable'
      reason = (error instanceof Error ? error.message : 'error').slice(0, 150)
    }
    const update: Record<string, unknown> = {
      verificationStatus: status,
      lastVerifiedAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      executableNow: status === 'verified',
      failureReason: reason || null
    }
    if (plan) {
      update.executionPlan = JSON.parse(JSON.stringify(plan)) as unknown
      newlyExecutable.push(`${entry.name} :: ${plan.operation.operationId} @ ${plan.baseUrl}${plan.operation.path}`)
    }
    if (status === 'verified') verified++
    else if (status === 'dead') dead++
    else if (status === 'requires_params') params++
    else other++
    await db.collection('tool_catalog').doc(entry.id).set(update, { merge: true })
    console.log(`[${status}] ${entry.name} ${reason ? `— ${reason}` : ''}`)
  }

  // MCP: classify + probe http candidates (BOUNDED page scan, quota-safe).
  let mcpExternal = 0
  let mcpExec = 0
  let mcpProbed = 0
  let mcpTouched = 0
  let mcpLast: string | null = null
  let mcpPages = 0
  while (mcpTouched < MCP_LIMIT && mcpPages < 12) {
    let mq: FirestoreQuery = db
      .collection('tool_catalog')
      .orderBy(FieldPath.documentId())
      .limit(500)
    if (mcpLast) mq = mq.startAfter(mcpLast)
    const msnap = await mq.get()
    if (msnap.empty) break
    mcpPages++
    for (const d of msnap.docs) {
      mcpLast = d.id
      const entry = { ...d.data(), id: d.id } as ToolCatalogEntry
      if (entry.type !== 'mcp') continue
      if (mcpTouched >= MCP_LIMIT) break
      if (entry.verificationStatus && entry.verificationStatus !== 'unverified') continue
      mcpTouched++
    const cls = classifyMcp(entry)
    if (cls.requiresExternalHost) {
      mcpExternal++
      await db.collection('tool_catalog').doc(entry.id).set(
        {
          requiresExternalHost: true,
          executableNow: false,
          verificationStatus: entry.verificationStatus ?? 'unverified',
          failureReason: cls.reason,
          lastChecked: new Date().toISOString()
        },
        { merge: true }
      )
      continue
    }
    mcpProbed++
    const probe = await probeMcpHttp(entry)
    if (probe.kind === 'executable') {
      mcpExec++
      await db.collection('tool_catalog').doc(entry.id).set(
        {
          requiresExternalHost: false,
          executableNow: true,
          verificationStatus: 'verified',
          lastVerifiedAt: new Date().toISOString(),
          lastChecked: new Date().toISOString(),
          failureReason: null
        },
        { merge: true }
      )
      console.log(`[mcp-verified] ${entry.name} tools=${probe.tools.slice(0, 5).join(',')}`)
    } else {
      mcpExternal++
      await db.collection('tool_catalog').doc(entry.id).set(
        {
          requiresExternalHost: true,
          executableNow: false,
          verificationStatus: entry.verificationStatus ?? 'unverified',
          failureReason: probe.reason,
          lastChecked: new Date().toISOString()
        },
        { merge: true }
      )
    }
    }
  }

  console.log('--- EXACT RESULTS ---')
  console.log(
    JSON.stringify(
      { apiCandidates: candidates.length, verified, dead, requiresParams: params, other, mcpExternal, mcpExec, mcpProbed, mcpTouched },
      null,
      2
    )
  )
  console.log('--- NEWLY EXECUTABLE (non-seed) ---')
  for (const line of newlyExecutable) console.log(`  ${line}`)
}

main().catch(err => {
  console.error('VERIFY FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
