import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp
} from 'drizzle-orm/pg-core'

/**
 * Nelth-IA Tool Catalog on PostgreSQL (Supabase, transaction pooler).
 * Mirrors ToolCatalogEntry 1:1 (snake_case). RLS intentionally unused:
 * access is server-only via DATABASE_URL, never from the browser.
 */

export const catalogEntryType = pgEnum('catalog_entry_type', ['rest', 'openapi', 'mcp'])
export const catalogAuth = pgEnum('catalog_auth', ['none', 'api_key', 'oauth', 'bearer', 'basic', 'unknown'] as const)
export const verificationStatus = pgEnum('catalog_verification_status', [
  'verified',
  'unverified',
  'dead',
  'requires_auth',
  'invalid_spec',
  'rate_limited',
  'temporarily_unavailable',
  'requires_params'
])

export const toolCatalog = pgTable(
  'tool_catalog',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('Uncategorized'),
    source: text('source').notNull().default('atlas'),
    type: catalogEntryType('type').notNull().default('rest'),
    endpoint: text('endpoint'),
    documentationUrl: text('documentation_url'),
    repository: text('repository'),
    transport: text('transport'),
    auth: catalogAuth('auth').notNull().default('unknown'),
    free: boolean('free').notNull().default(false),
    verified: boolean('verified').notNull().default(false),
    https: boolean('https').notNull().default(false),
    cors: boolean('cors'),
    vercelCompatible: boolean('vercel_compatible'),
    capabilities: text('capabilities').array().notNull().default([]),
    keywords: text('keywords').array().notNull().default([]),
    rateLimit: text('rate_limit'),
    license: text('license'),
    reliability: doublePrecision('reliability').notNull().default(0.5),
    lastChecked: timestamp('last_checked', { withTimezone: true }),
    executableNow: boolean('executable_now').notNull().default(false),
    requiresCredential: boolean('requires_credential').notNull().default(false),
    credentialConfigured: boolean('credential_configured').notNull().default(false),
    verificationStatus: verificationStatus('verification_status').notNull().default('unverified'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    requiresExternalHost: boolean('requires_external_host').notNull().default(false),
    executionPlan: jsonb('execution_plan'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [
    index('tool_catalog_type_idx').on(table.type),
    index('tool_catalog_auth_idx').on(table.auth),
    index('tool_catalog_free_idx').on(table.free).where(sql`free`),
    index('tool_catalog_verified_idx').on(table.verified).where(sql`verified`),
    index('tool_catalog_executable_now_idx').on(table.executableNow).where(sql`executable_now`),
    index('tool_catalog_verification_status_idx').on(table.verificationStatus),
    index('tool_catalog_category_idx').on(table.category),
    index('tool_catalog_source_idx').on(table.source),
    index('tool_catalog_capabilities_gin').using('gin', table.capabilities)
  ]
)

export const catalogSyncState = pgTable('catalog_sync_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const toolCatalogLive = pgTable('tool_catalog_live', {
  id: text('id').primaryKey(),
  entries: jsonb('entries').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const toolCatalogMeta = pgTable('tool_catalog_meta', {
  id: text('id').primaryKey(),
  lastSync: timestamp('last_sync', { withTimezone: true })
})

export type ToolCatalogRow = typeof toolCatalog.$inferSelect
