import { NextResponse } from 'next/server'

import { listFeed } from '@/lib/agent/store'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 30

// Read-only: feed items are written ONLY by real agent events
// (task completions/failures inside /api/agent/run).
export async function GET() {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid)
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  try {
    return NextResponse.json({ success: true, feed: await listFeed(uid) })
  } catch (err) {
    console.error('[agent] feed list failed:', err)
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 502 })
  }
}
