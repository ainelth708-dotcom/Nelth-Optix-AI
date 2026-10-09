/**
 * Firestore → Supabase chat history migration (idempotent, resumable).
 * Copies `chats` (+ `messages` subcollections) into chats/chat_messages.
 * Ownership is preserved 1:1 via the Firebase UID (userId) — no account is
 * ever mixed with another. NEVER deletes Firestore data. If the Firestore
 * database is unavailable it reports zero and exits cleanly (nothing to do).
 * Usage: bun scripts/migrate-chats-pg.mts [--batch=200] [--dry-run]
 * Needs: FIREBASE_SERVICE_ACCOUNT + DATABASE_URL (.env.local).
 */
import { config as loadEnv } from 'dotenv'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import { getPostgresDb } from '../lib/db/postgres'
import { chatMessages, chats } from '../lib/db/chat-schema'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)
const BATCH = Math.max(20, Math.min(500, Number(args.batch) || 200))
const DRY_RUN = args['dry-run'] === 'true'

function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  if (v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate()
  }
  return new Date(0)
}

async function main(): Promise<void> {
  const svc = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')
  ) as { project_id?: string }
  if (!svc.project_id) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')
  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL')
  initializeApp({ credential: cert(svc as never), projectId: svc.project_id })
  const fs = getFirestore()
  const { eq } = await import('drizzle-orm')
  const db = getPostgresDb()

  let lastId: string | null = null
  let chatsCopied = 0
  let messagesCopied = 0
  let skipped = 0
  for (;;) {
    let q = fs.collection('chats').orderBy('__name__').limit(BATCH)
    if (lastId) q = q.startAfter(lastId)
    let snap
    try {
      snap = await q.get()
    } catch (e) {
      console.log(
        'SOURCE_UNAVAILABLE: ' +
          (e instanceof Error ? e.message : String(e)).slice(0, 160)
      )
      break
    }
    if (snap.empty) break
    for (const doc of snap.docs) {
      lastId = doc.id
      const data = doc.data() as Record<string, unknown>
      if (typeof data.userId !== 'string' || !data.userId) {
        skipped++
        continue
      }
      const now = new Date()
      const chatRow = {
        id: doc.id,
        title: String(data.title ?? 'Untitled').slice(0, 255),
        userId: data.userId,
        visibility: data.visibility === 'public' ? ('public' as const) : ('private' as const),
        createdAt: toDate(data.createdAt),
        messageCount: typeof data.messageCount === 'number' ? data.messageCount : 0
      }
      const msgSnap = await doc.ref.collection('messages').get()
      const msgRows = msgSnap.docs.map(m => {
        const md = m.data() as Record<string, unknown>
        return {
          id: m.id,
          chatId: doc.id,
          role: String(md.role ?? 'user'),
          metadata: (md.metadata ?? null) as unknown as Record<string, unknown> | null,
          createdAt: toDate(md.createdAt),
          updatedAt: md.updatedAt ? toDate(md.updatedAt) : now,
          sequence: typeof md.sequence === 'number' ? md.sequence : null,
          parts: (md.parts ?? []) as unknown as Record<string, unknown>[]
        }
      })
      if (!DRY_RUN) {
        await db.insert(chats).values(chatRow).onConflictDoNothing()
        for (const row of msgRows) {
          await db.insert(chatMessages).values(row).onConflictDoNothing()
        }
      }
      chatsCopied++
      messagesCopied += msgRows.length
    }
    console.log(`  chats=${chatsCopied} messages=${messagesCopied} skipped=${skipped} last=${String(lastId).slice(0, 16)}…`)
  }

  // Destination compare (cheap aggregates, no full scan in app code).
  const [{ total: pgChats }] = await db
    .select({ total: (await import('drizzle-orm')).count() })
    .from(chats)
  const [{ total: pgMessages }] = await db
    .select({ total: (await import('drizzle-orm')).count() })
    .from(chatMessages)
  console.log('--- COMPARE ---')
  console.log(
    JSON.stringify(
      { firestoreChats: chatsCopied, firestoreMessages: messagesCopied, skipped, postgresChats: pgChats, postgresMessages: pgMessages, dryRun: DRY_RUN },
      null,
      2
    )
  )
  if (!DRY_RUN && (pgChats < chatsCopied || pgMessages < messagesCopied)) {
    console.log('MISMATCH: destination is missing rows — investigate before switching.')
    process.exitCode = 1
  }
  console.log('MIGRATION DONE (Firestore untouched)')
}

main().catch(err => {
  console.error('MIGRATE FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
