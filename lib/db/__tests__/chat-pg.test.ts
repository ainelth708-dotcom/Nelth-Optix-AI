/**
 * PostgreSQL chat persistence: per-account isolation by Firebase UID.
 * Runs against the REAL Supabase project when DATABASE_URL points at it;
 * skips cleanly otherwise (CI without credentials). Uses throwaway UIDs and
 * cleans up everything it creates.
 */
import { describe, expect, it, afterAll } from 'vitest'

import {
  createChat,
  deleteChat,
  deleteMessagesAfter,
  deleteUserChats,
  findExistingAssistantId,
  getChat,
  getChats,
  loadChat,
  loadChatWithMessages,
  updateChatTitle,
  updateChatVisibility,
  upsertMessage
} from '@/lib/db/actions-pg'
import { getPostgresDb } from '@/lib/db/postgres'

async function probe(): Promise<boolean> {
  try {
    const db = getPostgresDb()
    await db.execute('select 1' as never)
    return true
  } catch {
    return false
  }
}

const live = await probe()
const stamp = Date.now().toString(36)
const UID_A = `test-uid-a-${stamp}`
const UID_B = `test-uid-b-${stamp}`

async function userMessage(chatId: string, id: string, text: string) {
  return upsertMessage({
    id,
    chatId,
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: null
  } as never)
}

async function assistantMessage(chatId: string, id: string, text: string) {
  return upsertMessage({
    id,
    chatId,
    role: 'assistant',
    parts: [{ type: 'text', text }],
    metadata: null
  } as never)
}

;(live ? describe : describe.skip)('chat PG backend (Firebase UID isolation)', () => {
  afterAll(async () => {
    await deleteUserChats(UID_A)
    await deleteUserChats(UID_B)
  })

  it('creates chats keyed to each Firebase UID', async () => {
    const a = await createChat({ title: 'A chat', userId: UID_A })
    const b = await createChat({ title: 'B chat', userId: UID_B })
    expect(a.userId).toBe(UID_A)
    expect((await getChats(UID_A)).map(c => c.id)).toContain(a.id)
    expect((await getChats(UID_A)).map(c => c.id)).not.toContain(b.id)
    expect((await getChats(UID_B)).map(c => c.id)).toContain(b.id)
  })

  it('enforces visibility: private hidden cross-account, public shared', async () => {
    const chat = await createChat({ title: 'secret', userId: UID_A })
    expect(await getChat(chat.id, UID_B)).toBeNull()
    expect(await getChat(chat.id, UID_A)).not.toBeNull()
    await updateChatVisibility(chat.id, UID_A, 'public')
    expect(await getChat(chat.id, UID_B)).not.toBeNull()
    expect(await getChat(chat.id)).not.toBeNull()
    await updateChatVisibility(chat.id, UID_A, 'private')
  })

  it('persists messages with server sequences in order', async () => {
    const chat = await createChat({ title: 'seq', userId: UID_A })
    const m1 = await userMessage(chat.id, `u-${stamp}-1`, 'hello')
    const m2 = await assistantMessage(chat.id, `a-${stamp}-1`, 'hi there')
    expect(m1.sequence).toBe(1)
    expect(m2.sequence).toBe(2)
    // Re-saving keeps the original sequence (streaming-safe).
    const m2again = await assistantMessage(chat.id, `a-${stamp}-1`, 'hi there!')
    expect(m2again.sequence).toBe(2)
    const loaded = await loadChat(chat.id)
    expect(loaded.map(m => m.id)).toEqual([`u-${stamp}-1`, `a-${stamp}-1`])
    expect(await findExistingAssistantId(chat.id, `u-${stamp}-1`)).toBe(`a-${stamp}-1`)
  })

  it('updates title and deletes from index', async () => {
    const chat = await createChat({ title: 'old', userId: UID_A })
    await userMessage(chat.id, `u-${stamp}-2`, 'one')
    await userMessage(chat.id, `u-${stamp}-3`, 'two')
    const renamed = await updateChatTitle(chat.id, 'new', UID_A)
    expect(renamed?.title).toBe('new')
    const res = await deleteMessagesAfter(chat.id, `u-${stamp}-2`)
    expect(res.count).toBe(1)
    expect((await loadChat(chat.id)).map(m => m.id)).toEqual([`u-${stamp}-2`])
  })

  it('loads chat with messages for owner and blocks cross-account', async () => {
    const chat = await createChat({ title: 'alice chat', userId: UID_A })
    await userMessage(chat.id, `u-${stamp}-l1`, 'hi')
    await assistantMessage(chat.id, `a-${stamp}-l1`, 'hello')
    const loadedOwner = await loadChatWithMessages(chat.id, UID_A)
    expect(loadedOwner).not.toBeNull()
    expect(loadedOwner?.messages.length).toBe(2)
    const loadedOther = await loadChatWithMessages(chat.id, UID_B)
    expect(loadedOther).toBeNull()
  })

  it('deleteChat refuses other accounts', async () => {
    const chat = await createChat({ title: 'mine', userId: UID_A })
    expect(await deleteChat(chat.id, UID_B)).toMatchObject({ success: false })
    expect(await deleteChat(chat.id, UID_A)).toMatchObject({ success: true })
    expect(await getChat(chat.id, UID_A)).toBeNull()
  })
})
