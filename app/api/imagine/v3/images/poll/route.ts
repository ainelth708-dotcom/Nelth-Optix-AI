import { NextResponse } from 'next/server'

import { nelthaiPollJob } from '@/lib/imagine/nelthai'

export const maxDuration = 30

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    jobId?: unknown
  } | null

  const jobId = typeof body?.jobId === 'string' ? body.jobId : ''
  if (!jobId) {
    return NextResponse.json({ error: 'jobId requis.' }, { status: 400 })
  }

  try {
    const state = await nelthaiPollJob(jobId)
    return NextResponse.json({ success: true, ...state })
  } catch (err) {
    console.error('[imagine] v3/poll failed:', err)
    return NextResponse.json(
      { error: 'Le suivi a échoué, réessaie.' },
      { status: 502 }
    )
  }
}
