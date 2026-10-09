import type {
  ToolCatalogEntry,
  VerificationStatus
} from './types'

/**
 * Catalog storage backend contract. The agent talks ONLY to this interface —
 * never to Firestore or Supabase directly. Two implementations:
 * Firestore (legacy, default) and Supabase PostgreSQL. Switch + rollback via
 * CATALOG_DB_BACKEND=firestore|supabase (default: firestore).
 */

export type VerificationUpdate = {
  verificationStatus: VerificationStatus
  executableNow?: boolean
  requiresCredential?: boolean
  requiresExternalHost?: boolean
  failureReason?: string
  executionPlan?: ToolCatalogEntry['executionPlan']
}

export interface CatalogBackend {
  readonly name: 'firestore' | 'supabase'
  saveEntries(entries: ToolCatalogEntry[]): Promise<{
    upserted: number
    duplicatesSkipped: number
  }>
  loadAllEntries(): Promise<ToolCatalogEntry[]>
  readMeta(): Promise<{ lastSync: string | null }>
  writeMeta(lastSync: string): Promise<void>
  updateVerification(entryId: string, fields: VerificationUpdate): Promise<void>
  refreshLiveIndex(topN?: number): Promise<{ kept: number }>
  readLiveIndex(): Promise<ToolCatalogEntry[] | null>
  searchEntries(
    query: string,
    filters: {
      type?: 'rest' | 'openapi' | 'mcp' | 'all'
      auth?: 'none' | 'any'
      free?: boolean
      verified?: boolean
      vercelCompatible?: boolean
      category?: string
      limit?: number
    }
  ): Promise<ToolCatalogEntry[]>
}
