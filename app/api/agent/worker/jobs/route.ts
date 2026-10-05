import { NextResponse } from 'next/server'

import { WorkerUnavailableError } from '@/lib/agent/worker/adapter'
import { submitWorkerJob } from '@/lib/agent/worker/client'
import type { WorkerCapabilityName } from '@/lib/agent/worker/types'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 60

const CAPABILITIES: WorkerCapabilityName[] = [
  'browser',
  'computer',
  'shell',
  'proot'
]

export async function POST(req: Request) {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid)
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as {
    taskId?: unknown
    sessionId?: unknown
    capability?: unknown
    action?: unknown
    input?: unknown
    riskClass?: unknown
    riskTier?: unknown
    timeoutMs?: unknown
  } | null

  const capability = body?.capability
  if (
    typeof capability !== 'string' ||
    !(CAPABILITIES as string[]).includes(capability)
  ) {
    return NextResponse.json({ error: 'Capability invalide.' }, { status: 400 })
  }
  if (
    typeof body?.taskId !== 'string' ||
    !body.taskId ||
    typeof body?.action !== 'string' ||
    !body.action
  ) {
    return NextResponse.json(
      { error: 'taskId et action requis.' },
      { status: 400 }
    )
  }

  try {
    const { job, dispatched } = await submitWorkerJob(uid, {
      taskId: body.taskId,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
      capability: capability as WorkerCapabilityName,
      action: body.action.slice(0, 120),
      input:
        typeof body.input === 'object' && body.input !== null
          ? (body.input as Record<string, unknown>)
          : {},
      riskClass: typeof body.riskClass === 'string' ? body.riskClass : 'SAFE',
      riskTier: typeof body.riskTier === 'string' ? body.riskTier : 'NOTICE',
      timeoutMs:
        typeof body.timeoutMs === 'number' &&
        body.timeoutMs >= 5000 &&
        body.timeoutMs <= 600000
          ? body.timeoutMs
          : 120000
    })
    return NextResponse.json({ success: true, job, dispatched })
  } catch (err) {
    if (err instanceof WorkerUnavailableError) {
      // Honest UNAVAILABLE — never fake a worker.
      return NextResponse.json(
        { error: 'UNAVAILABLE', capability, message: err.message },
        { status: 503 }
      )
    }
    console.error('[agent] worker job failed:', err)
    return NextResponse.json({ error: 'Création impossible.' }, { status: 502 })
  }
}
