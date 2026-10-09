/**
 * Firestore → Supabase PostgreSQL catalog migration via Drizzle
 * (idempotent, resumable). Reads Firestore `tool_catalog` in bounded
 * ID-ordered pages, upserts into Postgres (onConflict id → no duplicates),
 * checkpoints every page into `catalog_sync_state`. NEVER deletes Firestore
 * data. Ends with source/destination compare + sample existence check.
 * Usage: bun scripts/migrate-catalog-pg.mts [--batch=500] [--dry-run]
 * Needs: FIREBASE_SERVICE_ACCOUNT (.env.local) + DATABASE_URL (server-only
 * Supabase transaction pooler). Neither is ever printed.
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { count, eq, sql } from 'drizzle-orm'

import { getPostgresDb } from '../agent/catalog/drizzle'
import { catalogSyncState, toolCatalog } from '../agent/catalog/schema'
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

function toInsert(e: ToolCatalogEntry) {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category,
    source: e.source,
    type: e.type,
    endpoint: e.endpoint ?? null,
    documentationUrl: e.documentationUrl ?? null,
    repository: e.repository ?? null,
    transport: e.transport ?? null,
    auth: e.auth,
    free: e.free,
    verified: e.verified,
    https: e.https,
    cors: e.cors ?? null,
    vercelCompatible: e.vercelCompatible ?? null,
    capabilities: e.capabilities ?? [],
    keywords: e.keywords ?? [],
    rateLimit: e.rateLimit ?? null,
    license: e.license ?? null,
    reliability: e.reliability ?? 0.5,
    lastChecked: e.lastChecked ? new Date(e.lastChecked) : null,
    executableNow: e.executableNow ?? false,
    requiresCredential: e.requiresCredential ?? false,
    credentialConfigured: e.credentialConfigured ?? false,
    verificationStatus: e.verificationStatus ?? 'unverified',
    lastVerifiedAt: e.lastVerifiedAt ? new Date(e.lastVerifiedAt) : null,
    failureReason: e.failureReason ?? null,
    requiresExternalHost: e.requiresExternalHost ?? false,
    executionPlan: (e.executionPlan ?? null) as unknown as Record<string, unknown> | null,
    updatedAt: new Date()
  }
}

async function main(): Promise<void> {
  const svc = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')
  ) as { project_id?: string }
  if (!svc.project_id) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL (server-only Supabase pooler URL)')
  }
  initializeApp({ credential: cert(svc as never), projectId: svc.project_id })
  const fs = getFirestore()
  const db = getPostgresDb()
  console.log(`migrate firestore(${svc.project_id}) -> postgres dryRun=${DRY_RUN} batch=${BATCH}`)

  const cpRows = await db
    .select()
    .from(catalogSyncState)
    .where(eq(catalogSyncState.key, 'firestore_import'))
    .limit(1)
  const state = (cpRows[0]?.value ?? {}) as { lastId?: string; imported?: number }
  let lastId: string | null = state.lastId ?? null
  let imported = state.imported ?? 0
  console.log(`checkpoint resume: lastId=${lastId ?? 'none'} imported=${imported}`)

  let scanned = 0
  for (;;) {
    let q = fs.collection('tool_catalog').orderBy('__name__').limit(BATCH)
    if (lastId) q = q.startAfter(lastId)
    const snap = await q.get()
    if (snap.empty) break
    const rows: ReturnType<typeof toInsert>[] = []
    snap.forEach(d => {
      lastId = d.id
      scanned++
      rows.push(toInsert({ ...d.data(), id: d.id } as ToolCatalogEntry))
    })
    if (!DRY_RUN) {
      for (const row of rows) {
        const { id: _id, ...rest } = row as Record<string, unknown> & { id: string }
        void _id
        await db
          .insert(toolCatalog)
          .values(row as typeof toolCatalog.$inferInsert)
          .onConflictDoUpdate({
            target: toolCatalog.id,
            set: rest as Partial<typeof toolCatalog.$inferInsert>
          })
      }
      imported += rows.length
      await db
        .insert(catalogSyncState)
        .values({
          key: 'firestore_import',
          value: { lastId, imported } as unknown as Record<string, unknown>,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: catalogSyncState.key,
          set: {
            value: { lastId, imported } as unknown as Record<string, unknown>,
            updatedAt: new Date()
          }
        })
    } else {
      imported += rows.length
    }
    console.log(`  scanned=${scanned} imported=${imported} lastId=${String(lastId).slice(0, 20)}…`)
  }

  const totalRows = await db.select({ total: count() }).from(toolCatalog)
  const pgCount = Number(totalRows[0]?.total ?? 0)
  console.log('--- COMPARE ---')
  console.log(JSON.stringify({ firestoreScanned: scanned, postgresCount: pgCount, dryRun: DRY_RUN }, null, 2))

  if (!DRY_RUN && scanned > 0) {
    const sampleSnap = await fs.collection('tool_catalog').orderBy('__name__').limit(200).get()
    const ids: string[] = []
    sampleSnap.forEach(d => ids.push(d.id))
    const picks = ids.filter((_, i) => i % Math.max(1, Math.floor(ids.length / 20)) === 0).slice(0, 20)
    const found = await db
      .select({ id: toolCatalog.id })
      .from(toolCatalog)
      .where(sql`${toolCatalog.id} = ANY(${picks})`)
    const foundSet = new Set(found.map(r => r.id))
    const missing = picks.filter(id => !foundSet.has(id))
    console.log(`sample check: ${picks.length - missing.length}/${picks.length} present${missing.length ? ` MISSING: ${missing.slice(0, 5).join(',')}` : ''}`)
    if (missing.length > 0) process.exitCode = 1
  }
  console.log('MIGRATION DONE (Firestore untouched — rollback = CATALOG_DB_BACKEND=firestore)')
}

main().catch(err => {
  console.error('MIGRATE FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
