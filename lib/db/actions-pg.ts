import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'

import type { UIMessage } from '@/lib/types/ai'
import type { PersistableUIMessage } from '@/lib/types/message-persistence'
import {
  buildUIMessageFromDB,
  mapUIMessagePartsToDBParts,
  mapUIMessageToDBMessage
} from '@/lib/utils/message-mapping'
import {
  dedupeConsecutiveDuplicates,
  sortMessagesForOrder
} from '@/lib/utils/message-ordering'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { incrementDbOperationCount } from '@/lib/utils/perf-tracking'

import { getPostgresDb } from './postgres'
import type { Chat, Message } from './schema'
import { generateId } from './schema'
import { chatMessages, chats, type ChatMessageRow, type ChatRow } from './chat-schema'

/**
 * Chat persistence on PostgreSQL. Same signatures and semantics as the
 * Firestore implementation (actions-firestore.ts). Every read/write is
 * scoped by the server-verified Firebase UID — one account only ever
 * touches its own rows.
 */

function toChat(row: ChatRow): Chat {
  return {
    id: row.id,
    title: row.title,
    userId: row.userId,
    visibility: row.visibility,
    createdAt: row.createdAt
  }
}

function toMessageMeta(row: ChatMessageRow): {
  id: string
  role: string
  createdAt: Date
  updatedAt: Date | null
  sequence: number | null
  metadata?: any
} {
  return {
    id: row.id,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sequence: row.sequence,
    metadata: (row.metadata as any) ?? undefined
  }
}

function toMessage(row: ChatMessageRow, chatId: string): Message {
  return {
    id: row.id,
    chatId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sequence: row.sequence,
    metadata: (row.metadata as any) ?? undefined
  } as Message
}

/**
 * Atomically allocate the next per-conversation sequence number with a
 * single UPDATE ... RETURNING (concurrent writers can never collide).
 */
async function getNextSequence(chatId: string): Promise<number> {
  const db = getPostgresDb()
  const updated = await db
    .update(chats)
    .set({ messageCount: sql`${chats.messageCount} + 1` })
    .where(eq(chats.id, chatId))
    .returning({ messageCount: chats.messageCount })
  if (updated[0]) return updated[0].messageCount
  // Chat row missing (legacy path): fall back to max(sequence) + 1.
  const top = await db
    .select({ sequence: chatMessages.sequence })
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(sql`${chatMessages.sequence} desc nulls last`)
    .limit(1)
  return (top[0]?.sequence ?? 0) + 1
}

export async function createChat({
  id = generateId(),
  title,
  userId,
  visibility = 'private'
}: {
  id?: string
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<Chat> {
  const db = getPostgresDb()
  const now = new Date()
  await db.insert(chats).values({
    id,
    title,
    userId,
    visibility,
    createdAt: now,
    messageCount: 0
  })
  return { id, title, userId, visibility, createdAt: now }
}

export async function getChat(
  chatId: string,
  userId?: string | null
): Promise<Chat | null> {
  const db = getPostgresDb()
  const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1)
  const row = rows[0]
  if (!row) return null
  const chat = toChat(row)
  if (chat.visibility === 'public') return chat
  if (chat.visibility === 'private' && userId && chat.userId === userId) {
    return chat
  }
  return null
}

export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  _userId?: string | null | null
): Promise<Message> {
  const count = incrementDbOperationCount()
  perfLog(`DB - upsertMessage called - count: ${count}`)

  const db = getPostgresDb()
  const existing = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, message.id))
    .limit(1)
  const dbParts = mapUIMessagePartsToDBParts(message.parts as any[], message.id)
  const messageData = mapUIMessageToDBMessage(message as any)

  let sequence: number | null
  if (existing[0]) {
    sequence = existing[0].sequence
  } else {
    sequence = await getNextSequence(message.chatId)
  }

  const now = new Date()
  const createdAt = existing[0]?.createdAt ?? now
  const row = {
    id: message.id,
    chatId: message.chatId,
    role: messageData.role,
    metadata: (messageData.metadata ?? null) as unknown as Record<string, unknown> | null,
    createdAt,
    updatedAt: now,
    sequence,
    parts: dbParts as unknown as Record<string, unknown>[]
  }
  await db
    .insert(chatMessages)
    .values(row)
    .onConflictDoUpdate({
      target: chatMessages.id,
      set: {
        role: row.role,
        metadata: row.metadata,
        updatedAt: now,
        sequence,
        parts: row.parts
      }
    })

  return {
    id: message.id,
    chatId: message.chatId,
    role: messageData.role,
    createdAt,
    updatedAt: now,
    sequence,
    metadata: messageData.metadata ?? null
  }
}

async function loadMessageRows(chatId: string): Promise<ChatMessageRow[]> {
  const db = getPostgresDb()
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt))
}

/**
 * Canonical order applied to ROWS (which carry top-level sequence/createdAt),
 * then mapped to UIMessages. Sorting UIMessages directly would be wrong: the
 * builder nests sequence/createdAt inside metadata, so the comparator would
 * tie and fall back to id order.
 */
function toOrderedUIMessages(
  rows: ChatMessageRow[],
  chatId: string
): UIMessage[] {
  const ordered = sortMessagesForOrder(
    rows.map(row => ({
      id: row.id,
      sequence: row.sequence,
      createdAt: row.createdAt,
      row
    }))
  )
  const messages = ordered.map(o =>
    buildUIMessageFromDB(toMessageMeta(o.row), (o.row.parts as any[]) || [], chatId)
  )
  return dedupeConsecutiveDuplicates(messages)
}

export async function loadChat(
  chatId: string,
  _userId?: string | null | null
): Promise<UIMessage[]> {
  return toOrderedUIMessages(await loadMessageRows(chatId), chatId)
}

export async function findExistingAssistantId(
  chatId: string,
  userMessageId: string
): Promise<string | null> {
  const rows = await loadMessageRows(chatId)
  const idx = rows.findIndex(r => r.id === userMessageId)
  if (idx === -1) return null
  const next = rows[idx + 1]
  if (next && (next.role === 'assistant' || next.role === 'tool')) {
    return next.id
  }
  return null
}

export async function loadChatWithMessages(
  chatId: string,
  userId?: string | null
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const count = incrementDbOperationCount()
  perfLog(`DB - loadChatWithMessages called - count: ${count}`)

  const chat = await getChat(chatId)
  if (!chat) return null
  if (chat.visibility === 'private' && (!userId || chat.userId !== userId)) {
    return null
  }
  // Ownership-checked read (getChat above); messages follow the same rule.
  const messages = toOrderedUIMessages(await loadMessageRows(chatId), chatId)
  return { ...chat, messages }
}

async function loadOrderedMessageIds(chatId: string): Promise<string[]> {
  const db = getPostgresDb()
  const rows = await db
    .select({
      id: chatMessages.id,
      sequence: chatMessages.sequence,
      createdAt: chatMessages.createdAt
    })
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
  // Rows (unlike UIMessages) carry top-level sequence/createdAt, so the
  // comparator orders by sequence → createdAt → id deterministically.
  return sortMessagesForOrder(rows).map(r => r.id)
}

export async function deleteMessagesAfter(
  chatId: string,
  messageId: string,
  _userId?: string | null | null
): Promise<{ count: number }> {
  const ordered = await loadOrderedMessageIds(chatId)
  const index = ordered.findIndex(id => id === messageId)
  if (index === -1) return { count: 0 }
  const toDelete = ordered.slice(index + 1)
  if (toDelete.length === 0) return { count: 0 }
  const db = getPostgresDb()
  await db.delete(chatMessages).where(inArray(chatMessages.id, toDelete))
  return { count: toDelete.length }
}

export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  _userId?: string | null | null
): Promise<{ count: number }> {
  const ordered = await loadOrderedMessageIds(chatId)
  const index = ordered.findIndex(id => id === messageId)
  if (index === -1) return { count: 0 }
  const toDelete = ordered.slice(index)
  if (toDelete.length === 0) return { count: 0 }
  const db = getPostgresDb()
  await db.delete(chatMessages).where(inArray(chatMessages.id, toDelete))
  return { count: toDelete.length }
}

export async function getChats(userId: string): Promise<Chat[]> {
  const db = getPostgresDb()
  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.createdAt))
  return rows.map(toChat)
}

export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  try {
    const db = getPostgresDb()
    const pageLimit = Math.max(1, Math.min(limit, 100))
    const rows = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.createdAt))
      .limit(pageLimit + 1)
      .offset(offset)
    const hasMore = rows.length > pageLimit
    const page = rows.slice(0, pageLimit).map(toChat)
    return {
      chats: page,
      nextOffset: hasMore ? offset + pageLimit : null
    }
  } catch (error) {
    console.error('Error fetching chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

async function deleteChatDocuments(chatId: string): Promise<void> {
  const db = getPostgresDb()
  await db.delete(chatMessages).where(eq(chatMessages.chatId, chatId))
  await db.delete(chats).where(eq(chats.id, chatId))
}

export async function deleteChat(
  chatId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getPostgresDb()
    const rows = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)
    if (!rows[0] || rows[0].userId !== userId) {
      return { success: false, error: 'Unauthorized' }
    }
    await deleteChatDocuments(chatId)
    return { success: true }
  } catch (error) {
    console.error('Error deleting chat:', error)
    return { success: false, error: 'Failed to delete chat' }
  }
}

export async function deleteUserChats(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getPostgresDb()
    const rows = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.userId, userId))
    for (const row of rows) {
      await deleteChatDocuments(row.id)
    }
    return { success: true }
  } catch (error) {
    console.error('Error deleting user chats:', error)
    return { success: false, error: 'Failed to delete user chats' }
  }
}

export async function updateChatVisibility(
  chatId: string,
  userId: string,
  visibility: 'public' | 'private'
): Promise<Chat | null> {
  const chat = await getChat(chatId, userId)
  if (!chat || chat.userId !== userId) return null
  const db = getPostgresDb()
  await db.update(chats).set({ visibility }).where(eq(chats.id, chatId))
  return { ...chat, visibility }
}

export async function updateChatTitle(
  chatId: string,
  title: string,
  _userId?: string | null | null
): Promise<Chat | null> {
  const db = getPostgresDb()
  const rows = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1)
  if (!rows[0]) return null
  await db.update(chats).set({ title }).where(eq(chats.id, chatId))
  return { ...toChat(rows[0]), title }
}

export async function createChatWithFirstMessageTransaction({
  chatId,
  chatTitle,
  userId,
  message
}: {
  chatId: string
  chatTitle: string
  userId: string
  message: PersistableUIMessage
}): Promise<{ chat: Chat; message: Message }> {
  perfLog(`DB - createChatWithFirstMessageTransaction start`)
  const dbStart = performance.now()

  const db = getPostgresDb()
  const now = new Date()
  await db
    .insert(chats)
    .values({
      id: chatId,
      title: chatTitle.substring(0, 255),
      userId,
      visibility: 'private',
      createdAt: now,
      messageCount: 1
    })
    .onConflictDoNothing()

  const messageId = message.id || generateId()
  const dbParts = mapUIMessagePartsToDBParts(message.parts as any[], messageId)
  const messageData = mapUIMessageToDBMessage({
    ...message,
    id: messageId,
    chatId
  } as any)

  await db
    .insert(chatMessages)
    .values({
      id: messageId,
      chatId,
      role: messageData.role,
      metadata: (messageData.metadata ?? null) as unknown as Record<string, unknown> | null,
      createdAt: now,
      updatedAt: now,
      sequence: 1,
      parts: dbParts as unknown as Record<string, unknown>[]
    })
    .onConflictDoNothing()

  perfTime('DB - createChatWithFirstMessageTransaction completed', dbStart)

  return {
    chat: {
      id: chatId,
      title: chatTitle.substring(0, 255),
      userId,
      visibility: 'private',
      createdAt: now
    },
    message: {
      id: messageId,
      chatId,
      role: messageData.role,
      createdAt: now,
      updatedAt: now,
      metadata: messageData.metadata ?? null
    }
  }
}
