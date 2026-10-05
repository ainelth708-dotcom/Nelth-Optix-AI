// Worker client: job lifecycle orchestration (persist → dispatch).
import { getWorkerAdapter, WorkerUnavailableError } from './adapter'
import {
  type CreateJobInput,
  createJobRecord,
  getJobRecord,
  updateJobRecord
} from './jobs'
import type { WorkerJob } from './types'

export async function submitWorkerJob(
  uid: string,
  input: CreateJobInput
): Promise<{ job: WorkerJob; dispatched: boolean }> {
  const job = await createJobRecord(uid, input)
  const adapter = getWorkerAdapter()
  if (!adapter) {
    throw new WorkerUnavailableError(input.capability)
  }
  try {
    const result = await adapter.dispatch(job)
    const updated =
      (await updateJobRecord(uid, job.id, {
        status: 'DISPATCHED',
        workerId: result.workerId
      })) ?? job
    return { job: updated, dispatched: true }
  } catch (err) {
    await updateJobRecord(uid, job.id, { status: 'FAILED' }).catch(() => {})
    throw err
  }
}

export async function cancelWorkerJob(
  uid: string,
  jobId: string
): Promise<WorkerJob | null> {
  const job = await getJobRecord(uid, jobId)
  if (!job) return null
  const adapter = getWorkerAdapter()
  if (adapter) await adapter.cancel(job)
  return (await updateJobRecord(uid, jobId, { status: 'CANCELLED' })) ?? job
}
