// Provider-neutral worker adapter. The runtime depends ONLY on this
// interface — never on a vendor SDK. HttpWorkerAdapter talks to any
// worker host implementing the job/event protocol over HTTPS.
import type { WorkerJob } from './types'

export interface DispatchResult {
  accepted: boolean
  workerId?: string
}

export interface WorkerAdapter {
  readonly name: string
  dispatch(job: WorkerJob, opts?: { uid?: string }): Promise<DispatchResult>
  cancel(job: WorkerJob): Promise<void>
}

export class WorkerUnavailableError extends Error {
  constructor(capability: string) {
    super(`Worker capability unavailable: ${capability}`)
    this.name = 'WorkerUnavailableError'
  }
}

function workerFetch(
  endpoint: string,
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(`${endpoint}${path}`, {
    ...init,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout))
}

export class HttpWorkerAdapter implements WorkerAdapter {
  readonly name = 'http-worker'
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`
    return headers
  }

  async dispatch(
    job: WorkerJob,
    opts?: { uid?: string }
  ): Promise<DispatchResult> {
    const res = await workerFetch(
      this.endpoint,
      '/jobs',
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          jobId: job.id,
          taskId: job.taskId,
          sessionId: job.sessionId,
          capability: job.capability,
          action: job.action,
          input: job.input,
          timeoutMs: job.timeoutMs,
          // Routing hint so the worker can echo it back in callbacks
          // (the control plane binds job→uid before trusting anything).
          ...(opts?.uid ? { uid: opts.uid } : {})
        })
      },
      Math.min(30000, job.timeoutMs)
    )
    if (!res.ok) {
      throw new Error(`Worker dispatch failed (${res.status}).`)
    }
    const data = (await res.json().catch(() => null)) as {
      workerId?: string
    } | null
    return { accepted: true, workerId: data?.workerId }
  }

  async cancel(job: WorkerJob): Promise<void> {
    await workerFetch(
      this.endpoint,
      `/jobs/${encodeURIComponent(job.id)}/cancel`,
      { method: 'POST', headers: this.headers() },
      15000
    ).catch(() => {})
  }
}

/** Null when no worker endpoint is configured → UNAVAILABLE, never fake. */
export function getWorkerAdapter(): WorkerAdapter | null {
  const endpoint = process.env.WORKER_ENDPOINT?.trim()
  if (!endpoint) return null
  return new HttpWorkerAdapter(
    endpoint,
    process.env.WORKER_API_KEY || undefined
  )
}
