import { NextResponse } from 'next/server'

import { nelthaiStartEditJob } from '@/lib/imagine/nelthai'

export const maxDuration = 60

/**
 * V3 image-to-image via source URL (no re-upload needed — the client
 * passes the fbcdn URL from the attachment upload).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    imageUrl?: unknown
    prompt?: unknown
    aspectRatio?: unknown
  } | null

  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : ''
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

  if (!/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json(
      { error: 'Image source requise.' },
      { status: 400 }
    )
  }
  if (!prompt) {
    return NextResponse.json(
      { error: 'Décris la modification.' },
      { status: 400 }
    )
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: 'Prompt trop long.' }, { status: 400 })
  }

  try {
    // Variations locked to 1 for edits; ratio already baked into `prompt`
    // by the client.
    const { jobId } = await nelthaiStartEditJob({
      imageUrl,
      prompt
    })
    return NextResponse.json({ success: true, jobId })
  } catch (err) {
    console.error('[imagine] v3/edit failed:', err)
    return NextResponse.json(
      { error: "L'édition a échoué, réessaie." },
      { status: 502 }
    )
  }
}
