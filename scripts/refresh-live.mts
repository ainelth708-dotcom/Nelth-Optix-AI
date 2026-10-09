/**
 * Refresh the quota-safe live index (tool_catalog_live/index) that the agent
 * hot path reads (1 doc instead of scanning 10k+ docs).
 * Run after sync/verify passes, once Firestore quota allows reads.
 * Usage: bun scripts/refresh-live.mts [--top=400]
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import type { ToolCatalogEntry } from '../agent/catalog/types'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const TOP = Math.max(
  50,
  Math.min(
    1000,
    Number(
      Object.fromEntries(
        process.argv.slice(2).map(a => {
          const [k, v] = a.replace(/^--/, '').split('=')
          return [k, v ?? 'true']
        })
      ).top ?? 400
    ) || 400
  )
)

async function main(): Promise<void> {
  const svc = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')
  ) as { project_id?: string }
  if (!svc.project_id) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')
  initializeApp({ credential: cert(svc as never), projectId: svc.project_id })
  const db = getFirestore()

  const snap = await db.collection('tool_catalog').get()
  const all: ToolCatalogEntry[] = []
  snap.forEach(d => all.push({ ...d.data(), id: d.id } as ToolCatalogEntry))
  console.log(`scanned=${all.length}`)
  const rank = (e: ToolCatalogEntry) =>
    (e.executableNow === true ? 100 : 0) +
    (e.verificationStatus === 'verified' ? 50 : 0) +
    (e.free && e.auth === 'none' ? 10 : 0) +
    (e.reliability ?? 0.5)
  const kept = all
    .filter(e => e.type !== 'mcp')
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, TOP)
  const clean = JSON.parse(JSON.stringify(kept)) as ToolCatalogEntry[]
  await db
    .collection('tool_catalog_live')
    .doc('index')
    .set({ updatedAt: new Date().toISOString(), entries: clean }, { merge: false })
  console.log(`live index refreshed: kept=${clean.length} (verified-exec first)`)
}

main().catch(err => {
  console.error('REFRESH FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
