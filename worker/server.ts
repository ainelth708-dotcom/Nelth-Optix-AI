// Nelth-IA reference worker (shell capability).
//
// A REAL, separately-hosted execution environment — this is what makes
// browser/computer/shell/background work without faking: the Next.js
// control plane creates jobs, THIS process executes them and calls back
// with HMAC-signed events. Run: `bun worker/server.ts` (or Docker).
// Env: WORKER_PORT, WORKER_API_KEY, WORKER_CALLBACK_SECRET,
//   CONTROL_PLANE_URL (e.g. https://nelth-ai-mg.vercel.app),
//   WORKER_ROOT (cwd jail), COMMAND_TIMEOUT_MS.
//
// Safety: bearer auth on /jobs, cwd jailed under WORKER_ROOT, timeouts,
// 64KB output caps, no secrets echoed. RiskGate approval happens
// control-plane-side BEFORE dispatch — the worker never self-authorizes.
import { spawn } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, sep } from 'node:path'

const PORT = Number(process.env.WORKER_PORT ?? 8787)
const API_KEY = process.env.WORKER_API_KEY ?? ''
const CALLBACK_SECRET = process.env.WORKER_CALLBACK_SECRET ?? ''
const CONTROL_PLANE_URL = (process.env.CONTROL_PLANE_URL ?? '').replace(
  /\/$/,
  ''
)
const WORKER_ROOT = resolve(process.env.WORKER_ROOT ?? './worker-data')
const DEFAULT_TIMEOUT = Number(process.env.COMMAND_TIMEOUT_MS ?? 60000)
const MAX_OUTPUT = 64 * 1024

mkdirSync(WORKER_ROOT, { recursive: true })

interface JobBody {
  jobId?: unknown
  taskId?: unknown
  sessionId?: unknown
  capability?: unknown
  action?: unknown
  input?: unknown
  timeoutMs?: unknown
  uid?: unknown
}

function json(
  res: import('node:http').ServerResponse,
  status: number,
  data: unknown
) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
}

function signEvent(input: {
  at: number
  jobId: string
  eventId: string
  type: string
}): string {
  return createHmac('sha256', CALLBACK_SECRET)
    .update(`${input.at}.${input.jobId}.${input.eventId}.${input.type}`)
    .digest('hex')
}

async function callback(
  uid: string,
  event: Record<string, unknown>
): Promise<void> {
  if (!CONTROL_PLANE_URL || !CALLBACK_SECRET) {
    console.error(
      '[worker] missing CONTROL_PLANE_URL or WORKER_CALLBACK_SECRET'
    )
    return
  }
  const at = Date.now()
  const eventId = `evt-${randomUUID()}`
  const full = { ...event, eventId, at }
  const signature = signEvent({
    at,
    jobId: String((event as { jobId?: unknown }).jobId ?? ''),
    eventId,
    type: String((event as { type?: unknown }).type ?? '')
  })
  const res = await fetch(`${CONTROL_PLANE_URL}/api/agent/worker/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-signature': signature
    },
    body: JSON.stringify({ uid, event: full })
  }).catch((err: unknown) => {
    console.error(
      '[worker] callback failed:',
      err instanceof Error ? err.message : err
    )
    return null
  })
  if (res && !res.ok) {
    console.error('[worker] callback rejected:', res.status)
  }
}

function resolveCwd(requested: unknown): string {
  const rel = typeof requested === 'string' ? requested : '.'
  const abs = resolve(WORKER_ROOT, rel)
  if (abs !== WORKER_ROOT && !abs.startsWith(WORKER_ROOT + sep)) {
    throw new Error('cwd escapes the worker jail')
  }
  mkdirSync(abs, { recursive: true })
  return abs
}

async function runShell(job: {
  jobId: string
  taskId: string
  uid: string
  command: string[]
  cwd: string
  timeoutMs: number
}): Promise<void> {
  const emit = (type: string, payload: Record<string, unknown> = {}) =>
    callback(job.uid, { jobId: job.jobId, taskId: job.taskId, type, payload })
  await emit('JOB_STARTED', { command: job.command })
  await emit('ACTION_STARTED', { action: 'exec' })

  let stdout = ''
  let stderr = ''
  let timedOut = false
  const exitCode: number = await new Promise(resolveExit => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(job.command[0], job.command.slice(1), {
        cwd: job.cwd,
        shell: false,
        env: { ...process.env }
      })
    } catch (err) {
      stderr = err instanceof Error ? err.message : String(err)
      resolveExit(127)
      return
    }
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        // Already exited.
      }
    }, job.timeoutMs)
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8').slice(0, MAX_OUTPUT - stdout.length)
    })
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8').slice(0, MAX_OUTPUT - stderr.length)
    })
    child.on('error', (err: Error) => {
      stderr += (stderr ? '\n' : '') + err.message
    })
    child.on('close', (code: number | null) => {
      clearTimeout(timer)
      resolveExit(timedOut ? 124 : (code ?? 1))
    })
  })

  await emit('OUTPUT', {
    exitCode,
    stdout: stdout.slice(0, MAX_OUTPUT),
    stderr: stderr.slice(0, MAX_OUTPUT)
  })
  await emit('ACTION_COMPLETED', { exitCode })
  if (timedOut || exitCode !== 0) {
    await emit('JOB_FAILED', {
      exitCode,
      error: timedOut ? 'timeout' : `exit-${exitCode}`
    })
  } else {
    await emit('JOB_COMPLETED', { exitCode })
  }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true, capabilities: ['shell'], root: WORKER_ROOT })
    return
  }
  if (req.method === 'POST' && req.url === '/jobs') {
    if (API_KEY) {
      const auth = req.headers.authorization ?? ''
      if (auth !== `Bearer ${API_KEY}`) {
        json(res, 401, { error: 'unauthorized' })
        return
      }
    }
    let raw = ''
    req.on('data', (c: Buffer) => {
      raw += c.toString('utf8')
      if (raw.length > 256 * 1024) req.destroy()
    })
    req.on('end', () => {
      let body: JobBody
      try {
        body = JSON.parse(raw || '{}') as JobBody
      } catch {
        json(res, 400, { error: 'invalid-json' })
        return
      }
      const capability = String(body.capability ?? '')
      const action = String(body.action ?? '')
      if (capability !== 'shell' || action !== 'exec') {
        json(res, 400, {
          error: 'only shell/exec is implemented by this worker'
        })
        return
      }
      const input = (
        typeof body.input === 'object' && body.input !== null ? body.input : {}
      ) as Record<string, unknown>
      const command = Array.isArray(input.command)
        ? input.command
            .filter((c): c is string => typeof c === 'string')
            .slice(0, 32)
        : []
      if (command.length === 0) {
        json(res, 400, { error: 'input.command string[] required' })
        return
      }
      const jobId =
        typeof body.jobId === 'string' && body.jobId
          ? body.jobId
          : `job-${randomUUID()}`
      const taskId = typeof body.taskId === 'string' ? body.taskId : ''
      const uid = typeof body.uid === 'string' ? body.uid : ''
      if (!taskId || !uid || !CALLBACK_SECRET || !CONTROL_PLANE_URL) {
        json(res, 400, {
          error: 'taskId, uid, CALLBACK_SECRET and CONTROL_PLANE_URL required'
        })
        return
      }
      let cwd = WORKER_ROOT
      try {
        cwd = resolveCwd(input.cwd)
      } catch (err) {
        json(res, 400, {
          error: err instanceof Error ? err.message : 'bad cwd'
        })
        return
      }
      const timeoutMs =
        typeof body.timeoutMs === 'number' &&
        body.timeoutMs >= 1000 &&
        body.timeoutMs <= 600000
          ? Math.floor(body.timeoutMs)
          : Math.min(DEFAULT_TIMEOUT, 600000)
      json(res, 202, { accepted: true, workerId: `local-shell-${process.pid}` })
      // Fire-and-forget execution; lifecycle reported via callbacks.
      void callback(uid, {
        jobId,
        taskId,
        type: 'JOB_CREATED',
        payload: {}
      }).then(() => runShell({ jobId, taskId, uid, command, cwd, timeoutMs }))
    })
    return
  }
  json(res, 404, { error: 'not-found' })
})

server.listen(PORT, () => {
  console.log(`[worker] shell worker on :${PORT} (root ${WORKER_ROOT})`)
})
