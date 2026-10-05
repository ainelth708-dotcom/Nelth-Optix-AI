import { NextResponse } from 'next/server'

import { ingestWorkerEvent } from '@/lib/agent/worker/events'

export const maxDuration = 60

// Worker → control-plane callbacks. Workers hold no user session, so
// authentication is HMAC (shared WORKER_CALLBACK_SECRET) + freshness
// window + job binding: the event is accepted only if its job exists
// under the claimed uid. Never trust arbitrary callbacks.
export async function POST(req: Request) {
  const signature = req.headers.get('x-worker-signature') ?? ''
  const body = (await req.json().catch(() => null)) as {
    uid?: unknown
    event?: unknown
  } | null
  if (typeof body?.uid !== 'string' || !body.uid) {
    return NextResponse.json({ error: 'uid requis.' }, { status: 400 })
  }
  try {
    const result = await ingestWorkerEvent({
      uid: body.uid,
      event: body.event,
      signature
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rejeté.'
    const status =
      /^(unauthorized-callback|invalid-event|unknown-job|task-mismatch)/.test(
        message
      )
        ? 403
        : 502
    console.error('[agent] worker callback rejected:', message)
    return NextResponse.json({ error: message }, { status })
  }
}
