/**
 * Nelth-imagen_V3 backend client (server-side only).
 * Base URL: https://nelthai.space-z.ai
 *
 * Two-step async flow: every call returns a job_id immediately, then poll
 * GET /api/metaai/jobs/{job_id} every 2-3s until status === "done".
 * progress.phase streams live state (sending → generating → image).
 */

const NELTHAI_API_BASE =
  process.env.NELTHAI_API_BASE_URL || 'https://nelthai.space-z.ai'

export interface NelthaiJobState {
  status: string
  imageUrls: string[]
  phase?: string
  note?: string
}

async function nelthaiFetch<T>(
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${NELTHAI_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const data = (await res.json().catch(() => null)) as
      | (T & { error?: string })
      | null
    if (!res.ok || !data) {
      throw new Error(
        (data as { error?: string } | null)?.error ||
          `NelthAI API error (${res.status})`
      )
    }
    if (typeof (data as { error?: string }).error === 'string') {
      throw new Error((data as { error?: string }).error)
    }
    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function nelthaiStartImageJob(prompt: string): Promise<{
  jobId: string
}> {
  const data = await nelthaiFetch<{
    job_id?: string
    jobId?: string
    id?: string
  }>('/api/metaai/image/async', { prompt, mode: 'instant' }, 30000)
  const jobId = data.job_id || data.jobId || data.id
  if (!jobId) throw new Error('No job_id returned')
  return { jobId }
}

export async function nelthaiStartEditJob(input: {
  imageUrl: string
  prompt: string
}): Promise<{ jobId: string }> {
  const data = await nelthaiFetch<{
    job_id?: string
    jobId?: string
    id?: string
  }>(
    '/api/metaai/image-to-image/async',
    { prompt: input.prompt, image_url: input.imageUrl, mode: 'instant' },
    30000
  )
  const jobId = data.job_id || data.jobId || data.id
  if (!jobId) throw new Error('No job_id returned')
  return { jobId }
}

export async function nelthaiPollJob(jobId: string): Promise<NelthaiJobState> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(
      `${NELTHAI_API_BASE}/api/metaai/jobs/${encodeURIComponent(jobId)}`,
      { signal: controller.signal }
    )
    const data = (await res.json().catch(() => null)) as {
      status?: string
      result?: { image_urls?: string[]; imageUrls?: string[] }
      progress?: { phase?: string; note?: string }
      error?: string
    } | null
    if (!res.ok || !data) {
      throw new Error(`Job poll failed (${res.status})`)
    }
    const imageUrls = data.result?.image_urls ?? data.result?.imageUrls ?? []
    return {
      status: data.status ?? 'unknown',
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      phase: data.progress?.phase,
      note: data.progress?.note
    }
  } finally {
    clearTimeout(timeout)
  }
}
