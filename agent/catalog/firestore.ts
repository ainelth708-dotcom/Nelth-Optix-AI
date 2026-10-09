import { getDb } from '@/lib/firebase/admin'

import type { CatalogBackend } from './backend'
import type { ToolCatalogEntry, VerificationStatus } from './types'

/**
 * Firestore backend (legacy). Chat history and the original catalog live
 * here; NOTHING is deleted during the Supabase migration. Kept as the
 * default until the migration is confirmed, then remains as rollback.
 */

const COLLECTION = 'tool_catalog'
const META_COLLECTION = 'tool_catalog_meta'
const META_DOC = 'sync'
const LIVE_COLLECTION = 'tool_catalog_live'
const LIVE_DOC = 'index'
const LIVE_TOP_N = 400

function dbOrNull(): ReturnType<typeof getDb> | null {
  try {
    return getDb()
  } catch {
    return null
  }
}

function dedupe(entries: ToolCatalogEntry[]): ToolCatalogEntry[] {
  const map = new Map<string, ToolCatalogEntry>()
  for (const entry of entries) {
    if (!entry.id) continue
    map.set(entry.id, entry)
  }
  return [...map.values()]
}

export const firestoreBackend: CatalogBackend = {
  name: 'firestore',

  async saveEntries(entries) {
    const unique = dedupe(entries)
    const duplicatesSkipped = entries.length - unique.length
    const db = dbOrNull()
    if (!db) return { upserted: 0, duplicatesSkipped }
    for (let i = 0; i < unique.length; i += 400) {
      const batch = db.batch()
      for (const entry of unique.slice(i, i + 400)) {
        batch.set(db.collection(COLLECTION).doc(entry.id), entry, { merge: true })
      }
      await batch.commit()
    }
    return { upserted: unique.length, duplicatesSkipped }
  },

  async loadAllEntries() {
    const db = dbOrNull()
    if (!db) return []
    const snap = await db.collection(COLLECTION).get()
    const entries: ToolCatalogEntry[] = []
    snap.forEach(doc => {
      entries.push({ ...(doc.data() as ToolCatalogEntry), id: doc.id })
    })
    return entries
  },

  async readMeta() {
    const db = dbOrNull()
    if (!db) return { lastSync: null }
    const snap = await db.collection(META_COLLECTION).doc(META_DOC).get()
    const data = snap.data() as { lastSync?: string } | undefined
    return { lastSync: data?.lastSync ?? null }
  },

  async writeMeta(lastSync: string) {
    const db = dbOrNull()
    if (!db) return
    await db
      .collection(META_COLLECTION)
      .doc(META_DOC)
      .set({ lastSync }, { merge: true })
  },

  async updateVerification(
    entryId: string,
    fields: {
      verificationStatus: VerificationStatus
      executableNow?: boolean
      requiresCredential?: boolean
      requiresExternalHost?: boolean
      failureReason?: string
    }
  ) {
    const db = dbOrNull()
    if (!db) return
    await db
      .collection(COLLECTION)
      .doc(entryId)
      .set(
        {
          ...fields,
          lastVerifiedAt: new Date().toISOString(),
          lastChecked: new Date().toISOString()
        },
        { merge: true }
      )
  },

  async refreshLiveIndex(topN = LIVE_TOP_N) {
    const db = dbOrNull()
    if (!db) return { kept: 0 }
    const snap = await db.collection(COLLECTION).get()
    const all: ToolCatalogEntry[] = []
    snap.forEach(d => all.push({ ...(d.data() as ToolCatalogEntry), id: d.id }))
    const priority = all
      .filter(e => e.type !== 'mcp')
      .sort((a, b) => {
        const rank = (e: ToolCatalogEntry) =>
          (e.executableNow === true ? 100 : 0) +
          (e.verificationStatus === 'verified' ? 50 : 0) +
          (e.free && e.auth === 'none' ? 10 : 0) +
          (e.reliability ?? 0.5)
        return rank(b) - rank(a)
      })
      .slice(0, topN)
    const clean = JSON.parse(JSON.stringify(priority)) as ToolCatalogEntry[]
    await db.collection(LIVE_COLLECTION).doc(LIVE_DOC).set(
      { updatedAt: new Date().toISOString(), entries: clean },
      { merge: false }
    )
    return { kept: clean.length }
  },

  async readLiveIndex() {
    const db = dbOrNull()
    if (!db) return null
    const snap = await db.collection(LIVE_COLLECTION).doc(LIVE_DOC).get()
    const data = snap.data() as { entries?: ToolCatalogEntry[] } | undefined
    return data?.entries?.length ? data.entries : null
  },

  async searchEntries() {
    // Firestore has no full-text search: the facade loads the cached full
    // catalog and scores locally. Prefer the Supabase backend for scale.
    throw new Error('searchEntries not supported by the Firestore backend')
  }
}
