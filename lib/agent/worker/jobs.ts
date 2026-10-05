// Worker job + event persistence on the EXISTING Firestore backend.
// Event docs use the client-generated eventId as document id: duplicate
// deliveries naturally overwrite the same doc (idempotent by construction).
import { getDb } from '@/lib/firebase/admin'

import type { WorkerEvent, WorkerJob, WorkerJobStatus } from './types'

function jobsCol(uid: string) {
  return getDb().collection('users').doc(uid).collection('agentWorkerJobs')
}

function toJob(id: string, data: FirebaseFirestore.DocumentData): WorkerJob {
  return {
    id,
    taskId: typeof data.taskId === 'string' ? data.taskId : '',
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : null,
    capability: data.capability ?? 'shell',
    action: typeof data.action === 'string' ? data.action : '',
    input:
      typeof data.input === 'object' && data.input !== null
        ? (data.input as Record<string, unknown>)
        : {},
    riskClass: typeof data.riskClass === 'string' ? data.riskClass : 'SAFE',
    riskTier: typeof data.riskTier === 'string' ? data.riskTier : 'NOTICE',
    status: (data.status as WorkerJobStatus) ?? 'CREATED',
    workerId: typeof data.workerId === 'string' ? data.workerId : null,
    timeoutMs: typeof data.timeoutMs === 'number' ? data.timeoutMs : 120000,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0
  }
}

export interface CreateJobInput {
  taskId: string
  sessionId?: string | null
  capability: WorkerJob['capability']
  action: string
  input?: Record<string, unknown>
  riskClass?: string
  riskTier?: string
  timeoutMs?: number
}

export async function createJobRecord(
  uid: string,
  input: CreateJobInput
): Promise<WorkerJob> {
  const now = Date.now()
  const ref = jobsCol(uid).doc()
  const job: WorkerJob = {
    id: ref.id,
    taskId: input.taskId,
    sessionId: input.sessionId ?? null,
    capability: input.capability,
    action: input.action.slice(0, 120),
    input: input.input ?? {},
    riskClass: input.riskClass ?? 'SAFE',
    riskTier: input.riskTier ?? 'NOTICE',
    status: 'CREATED',
    workerId: null,
    timeoutMs: input.timeoutMs ?? 120000,
    createdAt: now,
    updatedAt: now
  }
  await ref.set({ ...job, input: sanitize(job.input) })
  return job
}

/** Strip undefined (Firestore rejects it) without mutating secrets policy. */
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = sanitize(v)
    }
    return out
  }
  return value
}

export async function getJobRecord(
  uid: string,
  jobId: string
): Promise<WorkerJob | null> {
  const snap = await jobsCol(uid).doc(jobId).get()
  if (!snap.exists) return null
  return toJob(snap.id, snap.data() ?? {})
}

export async function updateJobRecord(
  uid: string,
  jobId: string,
  patch: Partial<Pick<WorkerJob, 'status' | 'workerId'>> & {
    updatedAt?: number
  }
): Promise<WorkerJob | null> {
  const ref = jobsCol(uid).doc(jobId)
  const snap = await ref.get()
  if (!snap.exists) return null
  await ref.update({ ...patch, updatedAt: Date.now() })
  const updated = await ref.get()
  return toJob(jobId, updated.data() ?? {})
}

export async function listJobRecords(
  uid: string,
  limit = 20
): Promise<WorkerJob[]> {
  const snap = await jobsCol(uid)
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(50, Math.max(1, limit)))
    .get()
  return snap.docs.map(d => toJob(d.id, d.data()))
}

export async function appendJobEvent(
  uid: string,
  jobId: string,
  event: WorkerEvent
): Promise<{ duplicate: boolean }> {
  const ref = jobsCol(uid).doc(jobId).collection('events').doc(event.eventId)
  const existing = await ref.get()
  if (existing.exists) return { duplicate: true }
  await ref.set({ ...event, payload: sanitize(event.payload ?? {}) })
  await jobsCol(uid)
    .doc(jobId)
    .update({ updatedAt: Date.now() })
    .catch(() => {})
  return { duplicate: false }
}

export async function listJobEvents(
  uid: string,
  jobId: string,
  limit = 100
): Promise<WorkerEvent[]> {
  const snap = await jobsCol(uid)
    .doc(jobId)
    .collection('events')
    .orderBy('at', 'asc')
    .limit(Math.min(200, Math.max(1, limit)))
    .get()
  return snap.docs.map(d => {
    const data = d.data()
    return {
      eventId: d.id,
      jobId,
      taskId: typeof data.taskId === 'string' ? data.taskId : '',
      type: data.type,
      at: typeof data.at === 'number' ? data.at : 0,
      payload:
        typeof data.payload === 'object' && data.payload !== null
          ? (data.payload as Record<string, unknown>)
          : {}
    } as WorkerEvent
  })
}
