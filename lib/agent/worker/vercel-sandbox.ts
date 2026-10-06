// Vercel Sandbox worker adapter (real Firecracker VMs, not simulated).
//
// Enabled explicitly via VERCEL_SANDBOX_ENABLED=true (Vercel OIDC auth is
// automatic in production; locally use `vercel env pull` for a dev token).
// One sandbox per task (named, resumable via Sandbox.get); shell/exec
// only — anything else fails honestly instead of pretending.
// Long commands are bounded by the calling route's own time budget;
// lifecycle events are ingested through the same HMAC path as remote
// workers so the event trail stays uniform.
import { Sandbox } from '@vercel/sandbox'

import { type WorkerAdapter,WorkerUnavailableError } from './adapter'
import { signWorkerEvent } from './auth'
import { ingestWorkerEvent } from './events'
import type { WorkerEventType, WorkerJob } from './types'

const sandboxNameFor = (taskId: string): string =>
  `nelth-${taskId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 48)}`

async function emit(
  uid: string | undefined,
  job: WorkerJob,
  type: WorkerEventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const secret = process.env.WORKER_CALLBACK_SECRET
  if (!uid || !secret) return
  const at = Date.now()
  const eventId = `${job.id}-${type.toLowerCase()}-${at}`
  const signature = signWorkerEvent({
    secret,
    at,
    jobId: job.id,
    eventId,
    type
  })
  // Best-effort trail: a failed event write must never fail the job.
  await ingestWorkerEvent({
    uid,
    event: { eventId, jobId: job.id, taskId: job.taskId, type, at, payload },
    signature
  }).catch(() => {})
}

export class VercelSandboxWorkerAdapter implements WorkerAdapter {
  readonly name = 'vercel-sandbox'

  private async sandboxFor(taskId: string) {
    const name = sandboxNameFor(taskId)
    try {
      return await Sandbox.get({ name })
    } catch {
      return Sandbox.create({
        name,
        timeout: 10 * 60 * 1000,
        ports: []
      })
    }
  }

  async dispatch(
    job: WorkerJob,
    opts?: { uid?: string }
  ): Promise<{ accepted: boolean; workerId?: string }> {
    if (job.capability !== 'shell' || job.action !== 'exec') {
      throw new WorkerUnavailableError(
        `${job.capability}/${job.action} (sandbox adapter: shell/exec only)`
      )
    }
    const input = (job.input ?? {}) as { command?: unknown; cwd?: unknown }
    const command = Array.isArray(input.command)
      ? input.command
          .filter((c): c is string => typeof c === 'string')
          .slice(0, 32)
      : []
    if (command.length === 0) {
      throw new Error('input.command string[] required')
    }
    const uid = opts?.uid
    const sandbox = await this.sandboxFor(job.taskId)
    await emit(uid, job, 'JOB_STARTED', { command: command.slice(0, 8) })
    await emit(uid, job, 'ACTION_STARTED', { action: 'exec' })
    const started = Date.now()
    try {
      // One sandbox per task (named + resumable) = the isolation
      // boundary; timeoutMs is enforced inside the VM with SIGKILL.
      const run = await sandbox.runCommand({
        cmd: command[0],
        args: command.slice(1),
        timeoutMs: Math.min(job.timeoutMs, 120000)
      })
      const stdout = String(run.stdout ?? '').slice(0, 65536)
      const stderr = String(run.stderr ?? '').slice(0, 65536)
      const exitCode = typeof run.exitCode === 'number' ? run.exitCode : 1
      await emit(uid, job, 'OUTPUT', { exitCode, stdout, stderr })
      await emit(uid, job, 'ACTION_COMPLETED', { exitCode })
      if (exitCode === 0) {
        await emit(uid, job, 'JOB_COMPLETED', {
          exitCode,
          elapsedMs: Date.now() - started
        })
      } else {
        await emit(uid, job, 'JOB_FAILED', {
          exitCode,
          error: `exit-${exitCode}`
        })
      }
      return { accepted: true, workerId: sandbox.name }
    } catch (err) {
      await emit(uid, job, 'JOB_FAILED', {
        error: err instanceof Error ? err.message : 'exec failed'
      })
      throw err instanceof Error ? err : new Error('Sandbox exec failed.')
    }
  }
  async cancel(job: WorkerJob): Promise<void> {
    try {
      const sandbox = await Sandbox.get({ name: sandboxNameFor(job.taskId) })
      await sandbox.stop()
    } catch {
      // Already gone — nothing to stop.
    }
  }
}

export function isVercelSandboxEnabled(): boolean {
  return process.env.VERCEL_SANDBOX_ENABLED === 'true'
}
