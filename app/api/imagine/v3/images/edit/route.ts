import { NextResponse } from 'next/server'

import { nelthaiStartEditJob } from '@/lib/imagine/nelthai'

export const maxDuration = 60

/**
 * V3 image-to-image via source URLs (no re-upload needed — the client
 * passes fbcdn URLs). Accepts one `imageUrl` or several `imageUrls`
 * (multi-image fusion), forwarded as repeated multipart fields.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    imageUrl?: unknown
    imageUrls?: unknown
    prompt?: unknown
    aspectRatio?: unknown
  } | null

  const collect = (v: unknown): string[] =>
    typeof v === 'string' && /^https?:\/\//.test(v) ? [v] : []
  const imageUrls = [
    ...(Array.isArray(body?.imageUrls) ? body.imageUrls.flatMap(collect) : []),
    ...collect(body?.imageUrl)
  ]
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

  if (imageUrls.length === 0) {
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
      imageUrls,
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
