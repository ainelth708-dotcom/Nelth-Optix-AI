import { NextResponse } from 'next/server'

import { planResume } from '@/lib/agent/runtime'
import { getAgentTask, listAgentTasks, saveAgentTask } from '@/lib/agent/store'
import type { AgentTask } from '@/lib/agent/task'
import { listJobEvents, listJobRecords } from '@/lib/agent/worker/jobs'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 60

async function uidOr401(): Promise<string | NextResponse> {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid)
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  return uid
}

function cleanTask(value: unknown): AgentTask | null {
  if (typeof value !== 'object' || value === null) return null
  const t = value as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.title !== 'string') return null
  if (typeof t.state !== 'string') return null
  return value as AgentTask
}

export async function GET(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  try {
    if (id) {
      const task = await getAgentTask(uid, id)
      if (!task)
        return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
      return NextResponse.json({ success: true, task })
    }
    return NextResponse.json({
      success: true,
      tasks: await listAgentTasks(uid)
    })
  } catch (err) {
    console.error('[agent] tasks read failed:', err)
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as {
    task?: unknown
  } | null
  const task = cleanTask(body?.task)
  if (!task)
    return NextResponse.json({ error: 'Tâche invalide.' }, { status: 400 })
  try {
    await saveAgentTask(uid, task)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[agent] tasks save failed:', err)
    return NextResponse.json(
      { error: 'Sauvegarde impossible.' },
      { status: 502 }
    )
  }
}

/**
 * Resume planning across HTTP requests: loads the persisted snapshot +
 * recent worker events and returns exactly where to continue — never
 * blindly repeating a possibly-completed action.
 */
export async function PUT(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as {
    taskId?: unknown
    totalSteps?: unknown
    doneSteps?: unknown
  } | null
  if (typeof body?.taskId !== 'string') {
    return NextResponse.json({ error: 'taskId requis.' }, { status: 400 })
  }
  try {
    const snapshot = await getAgentTask(uid, body.taskId)
    if (!snapshot) {
      return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
    }
    const totalSteps =
      typeof body.totalSteps === 'number' && body.totalSteps > 0
        ? Math.min(32, Math.floor(body.totalSteps))
        : 0
    const doneSteps = Array.isArray(body.doneSteps)
      ? body.doneSteps.filter((n): n is number => typeof n === 'number')
      : []
    // Newest worker events across the task (best-effort; empty is fine).
    const jobs = await listJobRecords(uid, 10)
    const mine = jobs.filter(j => j.taskId === body.taskId)
    const events = (
      await Promise.all(mine.map(j => listJobEvents(uid, j.id, 20)))
    ).flat()
    const plan = planResume({
      snapshot: { task: snapshot, totalSteps, doneSteps },
      events,
      totalSteps
    })
    return NextResponse.json({ success: true, plan })
  } catch (err) {
    console.error('[agent] tasks resume failed:', err)
    return NextResponse.json({ error: 'Reprise impossible.' }, { status: 502 })
  }
}
