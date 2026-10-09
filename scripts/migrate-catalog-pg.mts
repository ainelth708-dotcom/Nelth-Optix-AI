/**
 * Firestore → Supabase PostgreSQL catalog migration (idempotent, resumable).
 * - Reads Firestore `tool_catalog` in bounded ID-ordered pages.
 * - Upserts into Supabase `tool_catalog` (onConflict id → no duplicates).
 * - Checkpoints every page into `catalog_sync_state` (survives restarts).
 * - NEVER deletes Firestore data. Ends with source/destination compare +
 *   random-sample existence check.
 * Usage: bun scripts/migrate-catalog-pg.mts [--batch=500] [--dry-run]
 * Needs: FIREBASE_SERVICE_ACCOUNT (.env.local) + SUPABASE_URL +
 *   SUPABASE_SERVICE_ROLE_KEY. Run the SQL in supabase/migrations/ first.
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import { createClient } from '@supabase/supabase-js'

import type { ToolCatalogEntry } from '../agent/catalog/types'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const BATCH = Math.max(50, Math.min(1000, Number(args.batch) || 500))
const DRY_RUN = args['dry-run'] === 'true'

type Row = Record<string, unknown>

function toRow(e: ToolCatalogEntry): Row {
  const clean = JSON.parse(JSON.stringify(e)) as Record<string, unknown>
  return {
    id: clean.id,
    name: clean.name ?? '',
    description: clean.description ?? '',
    category: clean.category ?? 'Uncategorized',
    source: clean.source ?? 'atlas',
    type: clean.type ?? 'rest',
    endpoint: clean.endpoint ?? null,
    documentation_url: clean.documentationUrl ?? null,
    repository: clean.repository ?? null,
    transport: clean.transport ?? null,
    auth: clean.auth ?? 'unknown',
    free: clean.free ?? false,
    verified: clean.verified ?? false,
    https: clean.https ?? false,
    cors: clean.cors ?? null,
    vercel_compatible: clean.vercelCompatible ?? null,
    capabilities: clean.capabilities ?? [],
    keywords: clean.keywords ?? [],
    rate_limit: clean.rateLimit ?? null,
    license: clean.license ?? null,
    reliability: clean.reliability ?? 0.5,
    last_checked: clean.lastChecked ?? null,
    executable_now: clean.executableNow ?? false,
    requires_credential: clean.requiresCredential ?? false,
    credential_configured: clean.credentialConfigured ?? false,
    verification_status: clean.verificationStatus ?? 'unverified',
    last_verified_at: clean.lastVerifiedAt ?? null,
    failure_reason: clean.failureReason ?? null,
    requires_external_host: clean.requiresExternalHost ?? false,
    execution_plan: clean.executionPlan ?? null,
    updated_at: new Date().toISOString()
  }
}

async function main(): Promise<void> {
  const svc = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')
  ) as { project_id?: string }
  if (!svc.project_id) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local, never committed)')
  }
  initializeApp({ credential: cert(svc as never), projectId: svc.project_id })
  const fs = getFirestore()
  const pg = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  console.log(`migrate firestore(${svc.project_id}) -> supabase dryRun=${DRY_RUN} batch=${BATCH}`)

  // Resume from checkpoint.
  const cp = await pg.from('catalog_sync_state').select('value').eq('key', 'firestore_import').limit(1)
  if (cp.error) throw cp.error
  const state = (cp.data?.[0]?.value ?? {}) as { lastId?: string; imported?: number }
  let lastId: string | null = state.lastId ?? null
  let imported = state.imported ?? 0
  console.log(`checkpoint resume: lastId=${lastId ?? 'none'} imported=${imported}`)

  let scanned = 0
  for (;;) {
    let q = fs.collection('tool_catalog').orderBy('__name__').limit(BATCH)
    if (lastId) q = q.startAfter(lastId)
    const snap = await q.get()
    if (snap.empty) break
    const rows: Row[] = []
    snap.forEach(d => {
      lastId = d.id
      scanned++
      rows.push(toRow({ ...d.data(), id: d.id } as ToolCatalogEntry))
    })
    if (!DRY_RUN) {
      const { error } = await pg.from('tool_catalog').upsert(rows, { onConflict: 'id' })
      if (error) throw error
      imported += rows.length
      const { error: cpErr } = await pg
        .from('catalog_sync_state')
        .upsert({ key: 'firestore_import', value: { lastId, imported }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (cpErr) throw cpErr
    } else {
      imported += rows.length
    }
    console.log(`  scanned=${scanned} imported=${imported} lastId=${String(lastId).slice(0, 20)}…`)
  }

  // Compare: destination count + random sample existence.
  const { count: pgCount, error: countErr } = await pg
    .from('tool_catalog')
    .select('id', { count: 'exact', head: true })
  if (countErr) throw countErr
  console.log('--- COMPARE ---')
  console.log(JSON.stringify({ firestoreScanned: scanned, postgresCount: pgCount ?? 0, dryRun: DRY_RUN }, null, 2))

  // Random sample of 20 source IDs must exist in Postgres.
  if (!DRY_RUN && scanned > 0) {
    let s = fs.collection('tool_catalog').orderBy('__name__').limit(200)
    const sampleSnap = await s.get()
    const ids: string[] = []
    sampleSnap.forEach(d => ids.push(d.id))
    const picks = ids.filter((_, i) => i % Math.max(1, Math.floor(ids.length / 20)) === 0).slice(0, 20)
    const { data, error } = await pg.from('tool_catalog').select('id').in('id', picks)
    if (error) throw error
    const found = new Set((data ?? []).map((r: { id: string }) => r.id))
    const missing = picks.filter(id => !found.has(id))
    console.log(`sample check: ${picks.length - missing.length}/${picks.length} present${missing.length ? ` MISSING: ${missing.slice(0, 5).join(',')}` : ''}`)
    if (missing.length > 0) process.exitCode = 1
  }
  console.log('MIGRATION DONE (Firestore untouched — rollback = keep CATALOG_DB_BACKEND=firestore)')
}

main().catch(err => {
  console.error('MIGRATE FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
