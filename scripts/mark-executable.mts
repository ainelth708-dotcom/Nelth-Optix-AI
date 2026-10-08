/**
 * Marks individually proven catalog entries as executable (quota-light:
 * one query + one write per name). Resolution is re-done live (spec load +
 * match + REAL verification call) — nothing is marked on claims alone.
 * Usage: bun scripts/mark-executable.mts "D&D 5e API" "BirkinBagStock"
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import {
  loadOpenApiService,
  matchOperation,
  verifyOpenApiOperation
} from '../agent/catalog/exec'
import type { ToolCatalogEntry } from '../agent/catalog/types'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

async function main(): Promise<void> {
  const names = process.argv.slice(2)
  if (!names.length) throw new Error('Usage: bun scripts/mark-executable.mts "Name 1" "Name 2"')
  const svc = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')
  ) as { project_id?: string }
  if (!svc.project_id) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')
  initializeApp({ credential: cert(svc as never), projectId: svc.project_id })
  const db = getFirestore()

  for (const name of names) {
    const snap = await db.collection('tool_catalog').where('name', '==', name).limit(5).get()
    if (snap.empty) {
      console.log(`[not-found] ${name}`)
      continue
    }
    for (const doc of snap.docs) {
      const entry = { ...doc.data(), id: doc.id } as ToolCatalogEntry
      if (typeof entry.documentationUrl !== 'string' || !entry.documentationUrl) {
        console.log(`[no-spec] ${name}`)
        continue
      }
      const service = await loadOpenApiService(entry.documentationUrl)
      if (!service) {
        console.log(`[invalid_spec] ${name}`)
        await doc.ref.set(
          { verificationStatus: 'invalid_spec', executableNow: false, lastChecked: new Date().toISOString() },
          { merge: true }
        )
        continue
      }
      const terms = `${entry.name} ${entry.category} ${(entry.capabilities ?? []).join(' ')}`.split(/\s+/)
      const op = matchOperation(service, terms)
      if (!op) {
        console.log(`[no-op] ${name}`)
        continue
      }
      const outcome = await verifyOpenApiOperation(service, op)
      if (outcome.status === 'verified') {
        await doc.ref.set(
          {
            verificationStatus: 'verified',
            executableNow: true,
            requiresCredential: false,
            lastVerifiedAt: new Date().toISOString(),
            lastChecked: new Date().toISOString(),
            failureReason: null,
            executionPlan: {
              specUrl: entry.documentationUrl,
              baseUrl: service.baseUrl,
              operation: op,
              verifiedAt: new Date().toISOString()
            }
          },
          { merge: true }
        )
        console.log(`[MARKED-EXECUTABLE] ${name} :: ${op.operationId} @ ${service.baseUrl}${op.path}`)
      } else {
        await doc.ref.set(
          {
            verificationStatus: outcome.status === 'requires_params' ? 'requires_params' : outcome.status,
            executableNow: false,
            failureReason: (outcome.reason ?? '').slice(0, 200),
            lastChecked: new Date().toISOString()
          },
          { merge: true }
        )
        console.log(`[${outcome.status}] ${name} :: ${op.operationId} — ${outcome.reason ?? ''}`)
      }
    }
  }
}

main().catch(err => {
  console.error('MARK FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
