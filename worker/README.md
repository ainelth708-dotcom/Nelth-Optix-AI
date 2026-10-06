# Nelth-IA reference worker (shell capability)

A REAL, separately-hosted execution environment for the agent control
plane — not a simulation. The Next.js app creates jobs; this process
executes shell commands in a jailed working directory and reports back
with HMAC-signed events.

## Run locally

```bash
WORKER_PORT=8787 \
WORKER_API_KEY=dev-key \
WORKER_CALLBACK_SECRET=dev-secret \
CONTROL_PLANE_URL=http://localhost:3000 \
  bun worker/server.ts
```

Health check: `GET /health` → `{ ok, capabilities: ["shell"] }`.

## Activate in production

1. Host this worker where it stays up with a **public HTTPS URL**
   (VPS, Fly.io, Railway, Docker behind TLS — Vercel cannot host it).
2. In Vercel env (`nelth-ai-mg`), set:
   - `WORKER_ENDPOINT` = worker public URL (e.g. `https://worker.example.com`)
   - `WORKER_API_KEY` = same value as the worker's
   - `WORKER_CAPABILITIES` = `shell`
   - `WORKER_CALLBACK_SECRET` = same value as the worker's
3. Redeploy. `/api/agent/capabilities` flips `shell` to true and the UI
   stops showing it as unavailable.
4. Scheduling/heartbeat: set `AGENT_SCHEDULER_CONFIGURED=true` and point
   Vercel Cron at `GET /api/agent/heartbeat?uid=<userId>`.

Without these, capabilities honestly report UNAVAILABLE and the app
works normally (control-plane mode).

## Protocol (implemented here)

- `POST /jobs` (Bearer) `{jobId, taskId, sessionId, capability, action,
input: {command: string[], cwd?}, timeoutMs, uid}` → `202 {accepted,
workerId}` — only `shell`/`exec` is implemented; anything else is
  rejected, never faked.
- Callbacks `POST {CONTROL_PLANE_URL}/api/agent/worker/callback`
  `{uid, event}` + `x-worker-signature: HMAC(secret,
at.jobId.eventId.type)` with events `JOB_CREATED → JOB_STARTED →
ACTION_STARTED → OUTPUT → ACTION_COMPLETED → JOB_COMPLETED|JOB_FAILED`.

Safety: cwd jailed under `WORKER_ROOT`, timeouts, 64KB output caps,
`shell: false` (no string evaluation). RiskGate approval stays
control-plane-side before dispatch.
