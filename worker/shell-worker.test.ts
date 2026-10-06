// End-to-end proof: boots the REAL reference worker (worker/server.ts)
// plus a fake control plane, dispatches a genuine shell job through the
// adapter, and verifies the HMAC-signed callbacks. No mocks, no fakes —
// a real child_process spawn, real HTTP, real crypto verification.
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { HttpWorkerAdapter } from '@/lib/agent/worker/adapter'
import { verifyWorkerEvent } from '@/lib/agent/worker/auth'
import type { WorkerJob } from '@/lib/agent/worker/types'

const WORKER_PORT = 18887
const CP_PORT = 18888
const API_KEY = 'test-key-123'
const CALLBACK_SECRET = 'test-secret-abc'
const UID = 'user-test-1'

interface CapturedCallback {
  uid: unknown
  event: Record<string, unknown>
  signature: string
}

let worker: ChildProcess | null = null
let cp: Server | null = null
let workerRoot = ''
const callbacks: CapturedCallback[] = []

async function waitFor(
  cond: () => boolean,
  timeoutMs: number,
  stepMs = 100
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (cond()) return true
    await new Promise(r => setTimeout(r, stepMs))
  }
  return cond()
}

beforeAll(async () => {
  workerRoot = mkdtempSync(join(tmpdir(), 'nelth-worker-test-'))
  cp = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/agent/worker/callback') {
      let raw = ''
      req.on('data', (c: Buffer) => {
        raw += c.toString('utf8')
      })
      req.on('end', () => {
        try {
          const body = JSON.parse(raw || '{}') as {
            uid?: unknown
            event?: Record<string, unknown>
          }
          callbacks.push({
            uid: body.uid,
            event: body.event ?? {},
            signature: String(req.headers['x-worker-signature'] ?? '')
          })
        } catch {
          // Ignore malformed test traffic.
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"success":true}')
        return
      })
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  await new Promise<void>(resolve => cp!.listen(CP_PORT, '127.0.0.1', resolve))

  worker = spawn(process.execPath, ['worker/server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WORKER_PORT: String(WORKER_PORT),
      WORKER_API_KEY: API_KEY,
      WORKER_CALLBACK_SECRET: CALLBACK_SECRET,
      CONTROL_PLANE_URL: `http://127.0.0.1:${CP_PORT}`,
      WORKER_ROOT: workerRoot,
      COMMAND_TIMEOUT_MS: '15000'
    },
    stdio: 'ignore'
  })
  let healthy = false
  for (let i = 0; i < 50 && !healthy; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${WORKER_PORT}/health`)
      healthy = res.ok
    } catch {
      // Not up yet.
    }
    if (!healthy) await new Promise(r => setTimeout(r, 100))
  }
  expect(healthy).toBe(true)
}, 30000)

afterAll(async () => {
  worker?.kill('SIGKILL')
  worker = null
  await new Promise<void>(resolve => {
    if (!cp) return resolve()
    cp.close(() => resolve())
  })
  cp = null
  try {
    rmSync(workerRoot, { recursive: true, force: true })
  } catch {
    // Best effort cleanup.
  }
})

describe('reference shell worker (live)', () => {
  it('rejects unauthenticated dispatch', async () => {
    const res = await fetch(`http://127.0.0.1:${WORKER_PORT}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capability: 'shell', action: 'exec' })
    })
    expect(res.status).toBe(401)
  })

  it('rejects non-shell capabilities honestly', async () => {
    const res = await fetch(`http://127.0.0.1:${WORKER_PORT}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        jobId: 'job-nope',
        taskId: 'task-nope',
        uid: UID,
        capability: 'browser',
        action: 'navigate',
        input: {}
      })
    })
    expect(res.status).toBe(400)
  })

  it('executes a real shell job with signed callbacks', async () => {
    const adapter = new HttpWorkerAdapter(
      `http://127.0.0.1:${WORKER_PORT}`,
      API_KEY
    )
    const job: WorkerJob = {
      id: 'job-e2e-1',
      taskId: 'task-e2e-1',
      sessionId: null,
      capability: 'shell',
      action: 'exec',
      input: {
        command: [process.execPath, '-e', 'console.log("hello-worker")']
      },
      riskClass: 'SAFE',
      riskTier: 'NOTICE',
      status: 'CREATED',
      workerId: null,
      timeoutMs: 15000,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    const result = await adapter.dispatch(job, { uid: UID })
    expect(result.accepted).toBe(true)

    const done = await waitFor(
      () =>
        callbacks.some(
          c =>
            (c.event as { jobId?: unknown }).jobId === job.id &&
            (c.event as { type?: unknown }).type === 'JOB_COMPLETED'
        ),
      15000
    )
    expect(done).toBe(true)

    const mine = callbacks.filter(
      c => (c.event as { jobId?: unknown }).jobId === job.id
    )
    expect(mine.length).toBeGreaterThanOrEqual(4)
    // Every callback carries a verifiable HMAC signature.
    for (const c of mine) {
      const e = c.event as {
        at?: unknown
        jobId?: unknown
        eventId?: unknown
        type?: unknown
      }
      expect(c.uid).toBe(UID)
      const check = verifyWorkerEvent({
        secret: CALLBACK_SECRET,
        signature: c.signature,
        at: typeof e.at === 'number' ? e.at : NaN,
        jobId: typeof e.jobId === 'string' ? e.jobId : '',
        eventId: typeof e.eventId === 'string' ? e.eventId : '',
        type: typeof e.type === 'string' ? e.type : ''
      })
      expect(check).toEqual({ ok: true })
    }
    const output = mine.find(
      c => (c.event as { type?: unknown }).type === 'OUTPUT'
    )
    const payload = (output?.event as { payload?: unknown })?.payload as
      | { stdout?: unknown; exitCode?: unknown }
      | undefined
    expect(String(payload?.stdout ?? '')).toContain('hello-worker')
    expect(payload?.exitCode).toBe(0)
  }, 25000)
})
