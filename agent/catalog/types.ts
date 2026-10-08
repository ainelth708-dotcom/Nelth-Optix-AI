/**
 * Tool Catalog schema — represents thousands of APIs + MCP servers without
 * ever loading them all into a model prompt. Only discovery RESULTS
 * (top 3–10 executable tools) reach the orchestrator.
 */

export type CatalogEntryType = 'rest' | 'openapi' | 'mcp'

export type CatalogAuth = 'none' | 'api_key' | 'oauth' | 'bearer' | 'unknown'

export type ToolCatalogEntry = {
  /** Stable id: `atlas:<atlas-id>` or `local:<tool-name>`. */
  id: string
  name: string
  description: string
  category: string
  /** Which catalog it came from: 'atlas' | 'publicapis' | 'local' | ... */
  source: string
  type: CatalogEntryType
  /** Base URL / endpoint when known. */
  endpoint?: string
  documentationUrl?: string
  /** Repository for MCP servers. */
  repository?: string
  /** MCP transport: 'stdio' | 'http' | 'sse' | unknown. */
  transport?: string
  auth: CatalogAuth
  free: boolean
  /** True only for tools implemented + exercised in this project. */
  verified: boolean
  https: boolean
  cors?: boolean
  vercelCompatible?: boolean
  capabilities: string[]
  /** Extra search terms (synonyms, FR/EN). */
  keywords: string[]
  rateLimit?: string
  license?: string
  /** 0..1 — Atlas popularity/100, or 1 for local verified tools. */
  reliability?: number
  lastChecked?: string
}

export type CatalogStats = {
  total: number
  apis: number
  mcp: number
  free: number
  noAuth: number
  verified: number
  executable: number
  categories: number
  lastSync: string | null
  /** 'firestore' when synced data exists, otherwise 'seed'. Never hard-coded counts. */
  source: 'firestore' | 'seed'
}

export type SyncResult = {
  fetched: number
  upserted: number
  duplicatesSkipped: number
  failed: number
  /** Resume cursor per type when the page cap stopped the run. */
  nextCursors: { api: string | null; mcp: string | null }
  done: boolean
  stats: CatalogStats
}
