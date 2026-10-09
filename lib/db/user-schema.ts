import { bigint, index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Per-account user data on PostgreSQL. Every row carries the server-verified
 * Firebase UID (user_id) — Firebase Authentication remains the sole identity
 * provider; Google OAuth and session verification are untouched.
 */

export const userNotes = pgTable(
  'user_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    chatId: text('chat_id'),
    sourceMessageId: text('source_message_id'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [
    index('user_notes_user_updated_idx').on(table.userId, table.updatedAt),
    index('user_notes_user_id_idx').on(table.userId, table.id)
  ]
)

export const libraryFiles = pgTable(
  'library_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    chatId: text('chat_id'),
    filename: text('filename').notNull(),
    objectKey: text('object_key').notNull(),
    mediaType: text('media_type').notNull(),
    size: bigint('size', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [
    index('library_files_user_updated_idx').on(table.userId, table.updatedAt),
    index('library_files_user_id_idx').on(table.userId, table.id)
  ]
)

export const feedback = pgTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    sentiment: text('sentiment').notNull(),
    message: text('message').notNull(),
    pageUrl: text('page_url').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [index('feedback_user_idx').on(table.userId)]
)

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [index('rate_limits_expires_idx').on(table.expiresAt)]
)

export const connectorTokens = pgTable(
  'connector_tokens',
  {
    userId: text('user_id').notNull(),
    provider: text('provider').notNull(),
    refreshTokenSealed: text('refresh_token_sealed'),
    accessTokenSealed: text('access_token_sealed'),
    expiresAt: bigint('expires_at', { mode: 'number' }),
    scope: text('scope'),
    providerAccountId: text('provider_account_id'),
    providerAccountName: text('provider_account_name'),
    authFailedAt: bigint('auth_failed_at', { mode: 'number' }),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
  },
  table => [
    primaryKey({ columns: [table.userId, table.provider] }),
    index('connector_tokens_user_idx').on(table.userId)
  ]
)

export type UserNoteRow = typeof userNotes.$inferSelect
export type LibraryFileRow = typeof libraryFiles.$inferSelect
