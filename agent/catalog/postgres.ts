import { and, count, eq, ilike, or, sql } from 'drizzle-orm'

import type { CatalogBackend, VerificationUpdate } from './backend'
import { getPostgresDb } from './drizzle'
import { buildIndex, searchIndex } from './index'
import {
  catalogSyncState,
  toolCatalog,
  toolCatalogLive,
  toolCatalogMeta,
  type ToolCatalogRow
} from './schema'
import type { ToolCatalogEntry } from './types'

/**
 * PostgreSQL backend (Drizzle + postgres-js) for Supabase's
 * transaction-mode pooler. Server-side only.
 */

function fromRow(r: ToolCatalogRow): ToolCatalogEntry {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    source: r.source,
    type: r.type,
    endpoint: r.endpoint ?? undefined,
    documentationUrl: r.documentationUrl ?? undefined,
    repository: r.repository ?? undefined,
    transport: r.transport ?? undefined,
    auth: r.auth,
    free: r.free,
    verified: r.verified,
    https: r.https,
    cors: r.cors ?? undefined,
    vercelCompatible: r.vercelCompatible ?? undefined,
    capabilities: [...(r.capabilities ?? [])],
    keywords: [...(r.keywords ?? [])],
    rateLimit: r.rateLimit ?? undefined,
    license: r.license ?? undefined,
    reliability: r.reliability,
    lastChecked: r.lastChecked ? r.lastChecked.toISOString() : undefined,
    executableNow: r.executableNow,
    requiresCredential: r.requiresCredential,
    credentialConfigured: r.credentialConfigured,
    verificationStatus: r.verificationStatus,
    lastVerifiedAt: r.lastVerifiedAt ? r.lastVerifiedAt.toISOString() : undefined,
    failureReason: r.failureReason ?? undefined,
    requiresExternalHost: r.requiresExternalHost,
    executionPlan: (r.executionPlan as ToolCatalogEntry['executionPlan']) ?? undefined
  }
}

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

export const postgresBackend: CatalogBackend = {
  name: 'supabase',

  async saveEntries(entries) {
    const db = getPostgresDb()
    const seen = new Set<string>()
    const unique = entries.filter(e => {
      if (!e.id || seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500)
      for (const entry of chunk) {
        const row = toInsert(entry)
        // Full-row refresh on conflict (merge semantics, no duplicates).
        const { id: _id, createdAt: _created, ...rest } = row as Record<string, unknown> & { id: string }
        void _id
        void _created
        await db
          .insert(toolCatalog)
          .values(row as typeof toolCatalog.$inferInsert)
          .onConflictDoUpdate({
            target: toolCatalog.id,
            set: rest as Partial<typeof toolCatalog.$inferInsert>
          })
      }
    }
    return { upserted: unique.length, duplicatesSkipped: entries.length - unique.length }
  },

  async loadAllEntries() {
    const db = getPostgresDb()
    const out: ToolCatalogEntry[] = []
    const pageSize = 1000
    for (let page = 0; ; page++) {
      const rows = await db
        .select()
        .from(toolCatalog)
        .orderBy(toolCatalog.id)
        .limit(pageSize)
        .offset(page * pageSize)
      out.push(...rows.map(fromRow))
      if (rows.length < pageSize) break
    }
    return out
  },

  async readMeta() {
    const db = getPostgresDb()
    const rows = await db
      .select()
      .from(toolCatalogMeta)
      .where(eq(toolCatalogMeta.id, 'sync'))
      .limit(1)
    return { lastSync: rows[0]?.lastSync ? rows[0].lastSync.toISOString() : null }
  },

  async writeMeta(lastSync: string) {
    const db = getPostgresDb()
    await db
      .insert(toolCatalogMeta)
      .values({ id: 'sync', lastSync: new Date(lastSync) })
      .onConflictDoUpdate({
        target: toolCatalogMeta.id,
        set: { lastSync: new Date(lastSync) }
      })
  },

  async updateVerification(entryId, fields: VerificationUpdate) {
    const db = getPostgresDb()
    await db
      .update(toolCatalog)
      .set({
        verificationStatus: fields.verificationStatus,
        ...(fields.executableNow !== undefined ? { executableNow: fields.executableNow } : {}),
        ...(fields.requiresCredential !== undefined ? { requiresCredential: fields.requiresCredential } : {}),
        ...(fields.requiresExternalHost !== undefined ? { requiresExternalHost: fields.requiresExternalHost } : {}),
        ...(fields.failureReason !== undefined ? { failureReason: fields.failureReason || null } : {}),
        ...(fields.executionPlan !== undefined
          ? { executionPlan: (fields.executionPlan ?? null) as unknown as Record<string, unknown> | null }
          : {}),
        lastVerifiedAt: new Date()
      })
      .where(eq(toolCatalog.id, entryId))
  },

  async refreshLiveIndex(topN = 400) {
    const db = getPostgresDb()
    // Single ranked query — no full-table scan in application code.
    const rows = await db
      .select()
      .from(toolCatalog)
      .where(or(eq(toolCatalog.type, 'rest'), eq(toolCatalog.type, 'openapi')))
      .orderBy(
        sql`${toolCatalog.executableNow} desc`,
        sql`${toolCatalog.verificationStatus} = 'verified' desc`,
        sql`${toolCatalog.reliability} desc`
      )
      .limit(Math.max(50, Math.min(1000, topN)))
    await db
      .insert(toolCatalogLive)
      .values({ id: 'index', entries: rows as unknown as Record<string, unknown>[], updatedAt: new Date() })
      .onConflictDoUpdate({
        target: toolCatalogLive.id,
        set: { entries: rows as unknown as Record<string, unknown>[], updatedAt: new Date() }
      })
    return { kept: rows.length }
  },

  async readLiveIndex() {
    const db = getPostgresDb()
    const rows = await db
      .select()
      .from(toolCatalogLive)
      .where(eq(toolCatalogLive.id, 'index'))
      .limit(1)
    const raw = rows[0]?.entries as unknown
    if (!Array.isArray(raw)) return null
    return (raw as ToolCatalogRow[]).map(fromRow)
  },

  async searchEntries(query, filters) {
    const db = getPostgresDb()
    const limit = Math.max(1, Math.min(100, filters.limit ?? 20))
    const conditions = []
    if (filters.type && filters.type !== 'all') conditions.push(eq(toolCatalog.type, filters.type))
    if (filters.auth === 'none') conditions.push(eq(toolCatalog.auth, 'none'))
    if (filters.free === true) conditions.push(eq(toolCatalog.free, true))
    if (filters.verified === true) conditions.push(eq(toolCatalog.verified, true))
    if (filters.vercelCompatible === true) conditions.push(eq(toolCatalog.vercelCompatible, true))
    if (filters.category) conditions.push(ilike(toolCatalog.category, filters.category))
    // Bounded pre-filter (indexed), exact shared scorer applied below.
    const rows = await db
      .select()
      .from(toolCatalog)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(2000)
    const entries = rows.map(fromRow)
    return searchIndex(buildIndex(entries), query, { ...filters, limit }).map(s => s.entry)
  }
}

export async function postgresStats(): Promise<{
  total: number
  apis: number
  mcp: number
  free: number
  noAuth: number
}> {
  const db = getPostgresDb()
  const rows = await db
    .select({
      total: count(),
      apis: sql<number>`count(*) filter (where ${toolCatalog.type} <> 'mcp')`,
      mcp: sql<number>`count(*) filter (where ${toolCatalog.type} = 'mcp')`,
      free: sql<number>`count(*) filter (where ${toolCatalog.free})`,
      noAuth: sql<number>`count(*) filter (where ${toolCatalog.auth} = 'none')`
    })
    .from(toolCatalog)
  const r = rows[0]
  return {
    total: Number(r?.total ?? 0),
    apis: Number(r?.apis ?? 0),
    mcp: Number(r?.mcp ?? 0),
    free: Number(r?.free ?? 0),
    noAuth: Number(r?.noAuth ?? 0)
  }
}
