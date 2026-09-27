import { NextResponse } from 'next/server'

import { nelthaiStartImageJob } from '@/lib/imagine/nelthai'

export const maxDuration = 60

/**
 * Starts ONE V3 text-to-image job. The V3 backend takes no
 * variations/ratio params — both are baked into the prompt text
 * client-side, and a single job returns up to N image_urls.
 * Returns job ids; the client polls each one.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    prompt?: unknown
    variations?: unknown
    aspectRatio?: unknown
  } | null

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt requis.' }, { status: 400 })
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: 'Prompt trop long.' }, { status: 400 })
  }

  try {
    // Variations/ratio already baked into `prompt` by the client; one
    // job returns up to N image_urls.
    const { jobId } = await nelthaiStartImageJob(prompt)
    return NextResponse.json({ success: true, jobs: [jobId] })
  } catch (err) {
    console.error('[imagine] v3/images failed:', err)
    return NextResponse.json(
      { error: 'La génération a échoué, réessaie.' },
      { status: 502 }
    )
  }
}
