// Worker callback authentication (HMAC-SHA256, server-only).
//
// Workers sign every callback: signature = HMAC(secret, `${at}.${jobId}.${eventId}.${type}`).
// Verification enforces: correct signature (timing-safe), fresh timestamp
// (±5 min replay window). The shared secret lives ONLY in server env
// (WORKER_CALLBACK_SECRET) — never sent to browsers, never stored in Firestore.
import { createHmac, timingSafeEqual } from 'node:crypto'

const REPLAY_WINDOW_MS = 5 * 60 * 1000

export function signWorkerEvent(input: {
  secret: string
  at: number
  jobId: string
  eventId: string
  type: string
}): string {
  const payload = `${input.at}.${input.jobId}.${input.eventId}.${input.type}`
  return createHmac('sha256', input.secret).update(payload).digest('hex')
}

export function verifyWorkerEvent(input: {
  secret: string | undefined
  signature: string
  at: number
  jobId: string
  eventId: string
  type: string
  now?: number
}): { ok: true } | { ok: false; reason: string } {
  if (!input.secret)
    return { ok: false, reason: 'no-callback-secret-configured' }
  if (!input.signature) return { ok: false, reason: 'missing-signature' }
  const now = input.now ?? Date.now()
  if (
    !Number.isFinite(input.at) ||
    Math.abs(now - input.at) > REPLAY_WINDOW_MS
  ) {
    return { ok: false, reason: 'stale-or-future-timestamp' }
  }
  const expected = signWorkerEvent({
    secret: input.secret,
    at: input.at,
    jobId: input.jobId,
    eventId: input.eventId,
    type: input.type
  })
  const a = Buffer.from(expected, 'hex')
  let b: Buffer
  try {
    b = Buffer.from(input.signature, 'hex')
  } catch {
    return { ok: false, reason: 'malformed-signature' }
  }
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' }
  }
  return { ok: true }
}
