// Worker event ingestion: validate → persist → derive task updates.
//
// Pure validation (validateWorkerEvent) is unit-tested; persistence uses
// the Firestore jobs module (eventId doc = idempotent).
import type { AgentTaskState } from '../task'

import { verifyWorkerEvent } from './auth'
import { appendJobEvent, getJobRecord, updateJobRecord } from './jobs'
import type { WorkerEvent, WorkerEventType } from './types'

const KNOWN_TYPES: WorkerEventType[] = [
  'JOB_CREATED',
  'JOB_STARTED',
  'OBSERVING',
  'ACTION_STARTED',
  'ACTION_COMPLETED',
  'SCREENSHOT',
  'OUTPUT',
  'WAITING_APPROVAL',
  'JOB_COMPLETED',
  'JOB_FAILED',
  'JOB_CANCELLED'
]

export function validateWorkerEvent(event: unknown):
  | {
      ok: true
      event: WorkerEvent
    }
  | {
      ok: false
      reason: string
    } {
  if (typeof event !== 'object' || event === null) {
    return { ok: false, reason: 'not-an-object' }
  }
  const e = event as Record<string, unknown>
  if (typeof e.eventId !== 'string' || !e.eventId) {
    return { ok: false, reason: 'missing-eventId' }
  }
  if (typeof e.jobId !== 'string' || !e.jobId) {
    return { ok: false, reason: 'missing-jobId' }
  }
  if (typeof e.taskId !== 'string' || !e.taskId) {
    return { ok: false, reason: 'missing-taskId' }
  }
  if (!KNOWN_TYPES.includes(e.type as WorkerEventType)) {
    return { ok: false, reason: 'unknown-type' }
  }
  if (typeof e.at !== 'number' || !Number.isFinite(e.at)) {
    return { ok: false, reason: 'bad-timestamp' }
  }
  if (
    e.payload !== undefined &&
    (typeof e.payload !== 'object' || e.payload === null)
  ) {
    return { ok: false, reason: 'bad-payload' }
  }
  return {
    ok: true,
    event: {
      eventId: e.eventId,
      jobId: e.jobId,
      taskId: e.taskId,
      type: e.type as WorkerEventType,
      at: e.at,
      payload: (e.payload as Record<string, unknown>) ?? {}
    }
  }
}

const TERMINAL_JOB_STATUS = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
])

export function jobStatusForEvent(
  type: WorkerEventType
):
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | null {
  switch (type) {
    case 'JOB_CREATED':
      return null
    case 'JOB_STARTED':
    case 'OBSERVING':
    case 'ACTION_STARTED':
    case 'ACTION_COMPLETED':
    case 'SCREENSHOT':
    case 'OUTPUT':
      return 'RUNNING'
    case 'WAITING_APPROVAL':
      return 'WAITING_APPROVAL'
    case 'JOB_COMPLETED':
      return 'COMPLETED'
    case 'JOB_FAILED':
      return 'FAILED'
    case 'JOB_CANCELLED':
      return 'CANCELLED'
  }
}

export function agentStateForEvent(
  type: WorkerEventType
): AgentTaskState | null {
  switch (type) {
    case 'JOB_STARTED':
    case 'OBSERVING':
    case 'ACTION_STARTED':
    case 'ACTION_COMPLETED':
    case 'SCREENSHOT':
    case 'OUTPUT':
      return 'RUNNING'
    case 'WAITING_APPROVAL':
      return 'WAITING_APPROVAL'
    case 'JOB_COMPLETED':
      return 'VERIFYING'
    case 'JOB_FAILED':
      return 'FAILED'
    case 'JOB_CANCELLED':
      return 'CANCELLED'
    case 'JOB_CREATED':
      return null
  }
}

export interface IngestResult {
  duplicate: boolean
  jobStatus: string | null
  agentState: AgentTaskState | null
}

/**
 * Full ingest: signature + shape validation, job binding check,
 * idempotent persist, job status advance. Returns derived states for the
 * caller to apply to the task snapshot.
 */
export async function ingestWorkerEvent(input: {
  uid: string
  event: unknown
  signature: string
  now?: number
}): Promise<IngestResult> {
  const validated = validateWorkerEvent(input.event)
  if (!validated.ok) throw new Error(`invalid-event:${validated.reason}`)
  const event = validated.event

  const auth = verifyWorkerEvent({
    secret: process.env.WORKER_CALLBACK_SECRET,
    signature: input.signature,
    at: event.at,
    jobId: event.jobId,
    eventId: event.eventId,
    type: event.type,
    now: input.now
  })
  if (!auth.ok) throw new Error(`unauthorized-callback:${auth.reason}`)

  const job = await getJobRecord(input.uid, event.jobId)
  if (!job) throw new Error('unknown-job')
  if (job.taskId !== event.taskId) throw new Error('task-mismatch')
  if (TERMINAL_JOB_STATUS.has(job.status)) {
    // Late event for a finished job: record idempotently, change nothing.
    await appendJobEvent(input.uid, event.jobId, event)
    return { duplicate: false, jobStatus: job.status, agentState: null }
  }

  const { duplicate } = await appendJobEvent(input.uid, event.jobId, event)
  if (duplicate) return { duplicate: true, jobStatus: null, agentState: null }

  const jobStatus = jobStatusForEvent(event.type)
  if (jobStatus && jobStatus !== 'RUNNING') {
    await updateJobRecord(input.uid, event.jobId, { status: jobStatus })
  }
  return {
    duplicate: false,
    jobStatus: jobStatus ?? job.status,
    agentState: agentStateForEvent(event.type)
  }
}
