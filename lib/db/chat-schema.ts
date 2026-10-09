import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Chat persistence on PostgreSQL (Supabase, transaction pooler).
 * Every row is owned by a Firebase UID (user_id) — Firebase Authentication
 * stays the sole identity provider; Google OAuth and session verification
 * are untouched. All queries below filter by that UID: one account only
 * ever sees its own rows ("chacun relié à son ID").
 */

export const chatVisibility = pgEnum('chat_visibility', ['public', 'private'])

export const chats = pgTable(
  'chats',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    // Firebase UID of the owner. Never a client-supplied value: routes pass
    // only server-verified UIDs (getCurrentUserId).
    userId: text('user_id').notNull(),
    visibility: chatVisibility('visibility').notNull().default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Server-controlled per-conversation message counter (ordering).
    messageCount: integer('message_count').notNull().default(0)
  },
  table => [
    index('chats_user_created_idx').on(table.userId, table.createdAt),
    index('chats_visibility_idx').on(table.visibility)
  ]
)

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    sequence: integer('sequence'),
    parts: jsonb('parts').notNull().default([])
  },
  table => [
    index('chat_messages_chat_order_idx').on(table.chatId, table.sequence, table.createdAt),
    index('chat_messages_role_idx').on(table.chatId, table.role)
  ]
)

export type ChatRow = typeof chats.$inferSelect
export type ChatMessageRow = typeof chatMessages.$inferSelect
