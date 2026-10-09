import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type {
  CatalogBackend,
  VerificationUpdate
} from './backend'
import { buildIndex, searchIndex } from './index'
import type { ToolCatalogEntry } from './types'

/**
 * Supabase PostgreSQL backend. Server-side ONLY: uses the service_role key,
 * never exposed to the browser (no NEXT_PUBLIC_*). RLS is intentionally not
 * relied upon — these tables are never granted to anon/authenticated roles.
 */

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return client
}

type Row = Record<string, unknown>

function toRow(e: ToolCatalogEntry): Row {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category,
    source: e.source,
    type: e.type,
    endpoint: e.endpoint ?? null,
    documentation_url: e.documentationUrl ?? null,
    repository: e.repository ?? null,
    transport: e.transport ?? null,
    auth: e.auth,
    free: e.free,
    verified: e.verified,
    https: e.https,
    cors: e.cors ?? null,
    vercel_compatible: e.vercelCompatible ?? null,
    capabilities: e.capabilities ?? [],
    keywords: e.keywords ?? [],
    rate_limit: e.rateLimit ?? null,
    license: e.license ?? null,
    reliability: e.reliability ?? 0.5,
    last_checked: e.lastChecked ?? null,
    executable_now: e.executableNow ?? false,
    requires_credential: e.requiresCredential ?? false,
    credential_configured: e.credentialConfigured ?? false,
    verification_status: e.verificationStatus ?? 'unverified',
    last_verified_at: e.lastVerifiedAt ?? null,
    failure_reason: e.failureReason ?? null,
    requires_external_host: e.requiresExternalHost ?? false,
    execution_plan: (e.executionPlan ?? null) as unknown,
    updated_at: new Date().toISOString()
  }
}

function fromRow(r: Row): ToolCatalogEntry {
  const str = (v: unknown, d = ''): string =>
    typeof v === 'string' ? v : d
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    category: str(r.category, 'Uncategorized'),
    source: str(r.source, 'atlas'),
    type: (r.type === 'mcp' ? 'mcp' : r.type === 'openapi' ? 'openapi' : 'rest') as ToolCatalogEntry['type'],
    endpoint: (r.endpoint as string | null) ?? undefined,
    documentationUrl: (r.documentation_url as string | null) ?? undefined,
    repository: (r.repository as string | null) ?? undefined,
    transport: (r.transport as string | null) ?? undefined,
    auth: (r.auth as ToolCatalogEntry['auth']) ?? 'unknown',
    free: r.free === true,
    verified: r.verified === true,
    https: r.https === true,
    cors: (r.cors as boolean | null) ?? undefined,
    vercelCompatible: (r.vercel_compatible as boolean | null) ?? undefined,
    capabilities: arr(r.capabilities).map(s => s.toLowerCase()),
    keywords: arr(r.keywords).map(s => s.toLowerCase()),
    rateLimit: (r.rate_limit as string | null) ?? undefined,
    license: (r.license as string | null) ?? undefined,
    reliability: typeof r.reliability === 'number' ? r.reliability : 0.5,
    lastChecked: (r.last_checked as string | null) ?? undefined,
    executableNow: r.executable_now === true,
    requiresCredential: r.requires_credential === true,
    credentialConfigured: r.credential_configured === true,
    verificationStatus: (r.verification_status as ToolCatalogEntry['verificationStatus']) ?? 'unverified',
    lastVerifiedAt: (r.last_verified_at as string | null) ?? undefined,
    failureReason: (r.failure_reason as string | null) ?? undefined,
    requiresExternalHost: r.requires_external_host === true,
    executionPlan: (r.execution_plan as ToolCatalogEntry['executionPlan']) ?? undefined
  }
}

export const supabaseBackend: CatalogBackend = {
  name: 'supabase',

  async saveEntries(entries) {
    const db = getClient()
    const seen = new Set<string>()
    const unique = entries.filter(e => {
      if (!e.id || seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    let upserted = 0
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500).map(toRow)
      const { error } = await db.from('tool_catalog').upsert(chunk, { onConflict: 'id' })
      if (error) throw error
      upserted += chunk.length
    }
    return { upserted, duplicatesSkipped: entries.length - unique.length }
  },

  async loadAllEntries() {
    const db = getClient()
    const out: ToolCatalogEntry[] = []
    const pageSize = 1000
    for (let page = 0; ; page++) {
      const { data, error } = await db
        .from('tool_catalog')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as Row[]
      out.push(...rows.map(fromRow))
      if (rows.length < pageSize) break
    }
    return out
  },

  async readMeta() {
    const db = getClient()
    const { data, error } = await db
      .from('tool_catalog_meta')
      .select('last_sync')
      .eq('id', 'sync')
      .limit(1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ last_sync: string | null }>
    return { lastSync: rows[0]?.last_sync ?? null }
  },

  async writeMeta(lastSync: string) {
    const db = getClient()
    const { error } = await db
      .from('tool_catalog_meta')
      .upsert({ id: 'sync', last_sync: lastSync }, { onConflict: 'id' })
    if (error) throw error
  },

  async updateVerification(entryId, fields: VerificationUpdate) {
    const db = getClient()
    const patch: Row = {
      verification_status: fields.verificationStatus,
      last_verified_at: new Date().toISOString()
    }
    if (fields.executableNow !== undefined) patch.executable_now = fields.executableNow
    if (fields.requiresCredential !== undefined) patch.requires_credential = fields.requiresCredential
    if (fields.requiresExternalHost !== undefined) patch.requires_external_host = fields.requiresExternalHost
    if (fields.failureReason !== undefined) patch.failure_reason = fields.failureReason || null
    if (fields.executionPlan !== undefined) patch.execution_plan = (fields.executionPlan ?? null) as unknown
    const { error } = await db.from('tool_catalog').update(patch).eq('id', entryId)
    if (error) throw error
  },

  async refreshLiveIndex(topN = 400) {
    const db = getClient()
    // Single ranked query — no full-table scan in application code.
    const { data, error } = await db
      .from('tool_catalog')
      .select('*')
      .neq('type', 'mcp')
      .order('executable_now', { ascending: false })
      .order('reliability', { ascending: false })
      .limit(Math.max(50, Math.min(1000, topN)))
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    const clean = JSON.parse(JSON.stringify(rows)) as Row[]
    const { error: upsertError } = await db
      .from('tool_catalog_live')
      .upsert({ id: 'index', entries: clean, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (upsertError) throw new Error(upsertError.message)
    return { kept: clean.length }
  },

  async readLiveIndex() {
    const db = getClient()
    const { data, error } = await db
      .from('tool_catalog_live')
      .select('entries')
      .eq('id', 'index')
      .limit(1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ entries: unknown }>
    const raw = rows[0]?.entries
    if (!Array.isArray(raw)) return null
    return (raw as Row[]).map(fromRow)
  },

  async searchEntries(query, filters) {
    const db = getClient()
    const limit = Math.max(1, Math.min(100, filters.limit ?? 20))
    // Indexed pre-filter first (bounded), relevance ranking applied below.
    let q = db.from('tool_catalog').select('*').limit(2000)
    if (filters.type && filters.type !== 'all') q = q.eq('type', filters.type)
    if (filters.auth === 'none') q = q.eq('auth', 'none')
    if (filters.free === true) q = q.eq('free', true)
    if (filters.verified === true) q = q.eq('verified', true)
    if (filters.vercelCompatible === true) q = q.eq('vercel_compatible', true)
    if (filters.category) q = q.ilike('category', filters.category)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const entries = ((data ?? []) as Row[]).map(fromRow)
    // Identical scorer as the memory path (token relevance + priority).
    return searchIndex(buildIndex(entries), query, { ...filters, limit }).map(
      s => s.entry
    )
  }
}
