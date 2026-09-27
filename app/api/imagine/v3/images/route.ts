import { NextResponse } from 'next/server'

import { nelthaiStartImageJob } from '@/lib/imagine/nelthai'

export const maxDuration = 60

/**
 * Starts N parallel V3 text-to-image jobs (one per variation). The V3
 * backend takes no variations/ratio params — both are baked into the
 * prompt text. Returns job ids; the client polls each one.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    prompt?: unknown
    variations?: unknown
    aspectRatio?: unknown
  } | null

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  const variations =
    typeof body?.variations === 'number' &&
    Number.isInteger(body.variations) &&
    body.variations >= 1 &&
    body.variations <= 4
      ? body.variations
      : 1

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt requis.' }, { status: 400 })
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: 'Prompt trop long.' }, { status: 400 })
  }

  try {
    // Variations/ratio already baked into `prompt` by the client.
    const started = await Promise.all(
      Array.from({ length: variations }, () => nelthaiStartImageJob(prompt))
    )
    return NextResponse.json({
      success: true,
      jobs: started.map(s => s.jobId)
    })
  } catch (err) {
    console.error('[imagine] v3/images failed:', err)
    return NextResponse.json(
      { error: 'La génération a échoué, réessaie.' },
      { status: 502 }
    )
  }
}
