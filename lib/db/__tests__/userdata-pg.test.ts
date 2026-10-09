/**
 * PostgreSQL user-data backends: notes, library files, feedback, rate
 * limits, connector vault. Real database, throwaway Firebase UIDs, full
 * cleanup. Skips cleanly without DATABASE_URL.
 */
import { afterAll, describe, expect, it } from 'vitest'

process.env.CONNECTORS_ENCRYPTION_KEY =
  process.env.CONNECTORS_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import {
  anonymizeUserFeedback,
  createLibraryFile,
  createNote,
  deleteLibraryFile,
  deleteNote,
  deleteUserLibraryFiles,
  deleteUserNotes,
  getLibraryFiles,
  getNote,
  getNotes,
  searchLibraryFiles,
  searchNotes,
  submitSiteFeedback
} from '@/lib/db/actions-pg'
import { getPostgresDb } from '@/lib/db/postgres'
import { feedback } from '@/lib/db/user-schema'
import { incrementRateLimit } from '@/lib/rate-limit/store'
import {
  deleteConnection,
  getConnection,
  getValidAccessToken,
  hasConnection,
  markConnectorAuthFailure,
  saveConnection
} from '@/lib/connectors/vault'
import { eq } from 'drizzle-orm'

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
const UID_A = `udata-a-${stamp}`
const UID_B = `udata-b-${stamp}`

;(live ? describe : describe.skip)('userdata PG backends (UID isolation)', () => {
  afterAll(async () => {
    await deleteUserNotes(UID_A)
    await deleteUserNotes(UID_B)
    await deleteUserLibraryFiles(UID_A)
    await deleteUserLibraryFiles(UID_B)
    await deleteConnection(UID_A, 'github' as never)
    const db = getPostgresDb()
    await db.delete(feedback).where(eq(feedback.userId, UID_A))
  })

  it('notes CRUD stays per-account', async () => {
    const note = await createNote({
      userId: UID_A,
      chatId: null,
      sourceMessageId: null,
      title: 'Shopping',
      content: 'buy milk'
    })
    expect(note.userId).toBe(UID_A)
    expect(await getNote(note.id, UID_B)).toBeNull()
    expect((await getNote(note.id, UID_A))?.title).toBe('Shopping')
    expect((await searchNotes(UID_A, 'shop')).map(n => n.id)).toContain(note.id)
    expect((await getNotes(UID_A)).notes.map(n => n.id)).toContain(note.id)
    expect((await getNotes(UID_B)).notes).toEqual([])
    expect(await deleteNote(note.id, UID_B)).toMatchObject({ success: false })
    expect(await deleteNote(note.id, UID_A)).toMatchObject({ success: true })
  })

  it('library files CRUD stays per-account', async () => {
    const file = await createLibraryFile({
      userId: UID_A,
      chatId: null,
      filename: 'doc.pdf',
      objectKey: `test/${stamp}/doc.pdf`,
      mediaType: 'application/pdf',
      size: 123
    })
    expect((await getLibraryFiles(UID_A)).files.map(f => f.id)).toContain(file.id)
    expect((await getLibraryFiles(UID_B)).files).toEqual([])
    expect((await searchLibraryFiles(UID_A, 'doc')).map(f => f.id)).toContain(file.id)
    expect(await deleteLibraryFile(file.id, UID_B)).toMatchObject({ success: false })
    expect(await deleteLibraryFile(file.id, UID_A)).toMatchObject({ success: true })
  })

  it('site feedback + anonymize', async () => {
    const { id } = await submitSiteFeedback({
      sentiment: 'positive',
      message: 'great',
      pageUrl: '/',
      userId: UID_A,
      userAgent: 'test'
    })
    expect(id).toBeTruthy()
    expect(await anonymizeUserFeedback(UID_A)).toMatchObject({ success: true })
    const db = getPostgresDb()
    const rows = await db.select().from(feedback).where(eq(feedback.id, id))
    expect(rows[0]?.userId).toBeNull()
    await db.delete(feedback).where(eq(feedback.id, id))
  })

  it('rate limit increments daily counters', async () => {
    const key = `test:rl:${stamp}`
    const first = await incrementRateLimit(key, 2)
    expect(first.used).toBe(1)
    expect(first.allowed).toBe(true)
    expect(first.enforced).toBe(true)
    const second = await incrementRateLimit(key, 2)
    expect(second.used).toBe(2)
    expect(second.allowed).toBe(true)
    const third = await incrementRateLimit(key, 2)
    expect(third.allowed).toBe(false)
    expect(third.remaining).toBe(0)
    const db = getPostgresDb()
    const { rateLimits } = await import('@/lib/db/user-schema')
    await db.delete(rateLimits).where(eq(rateLimits.key, key))
  })

  it('connector vault seals tokens per account', async () => {
    const provider = 'github' as never
    await saveConnection(UID_A, provider, {
      accessToken: 'fresh-access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3600_000
    } as never)
    expect(await hasConnection(UID_A, provider)).toBe(true)
    expect(await hasConnection(UID_B, provider)).toBe(false)
    // Fresh token served without network.
    expect(await getValidAccessToken(UID_A, provider)).toBe('fresh-access-token')
    const stored = await getConnection(UID_A, provider)
    expect(stored?.accessTokenSealed).not.toContain('fresh-access-token')
    await markConnectorAuthFailure(UID_A, provider)
    await expect(getValidAccessToken(UID_A, provider)).rejects.toThrow()
    await deleteConnection(UID_A, provider)
    expect(await hasConnection(UID_A, provider)).toBe(false)
  })
})
