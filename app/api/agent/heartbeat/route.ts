import { NextResponse } from 'next/server'

import { computeNextRun } from '@/lib/agent/scheduling'
import {
  appendFeed,
  listActiveAgentTasks,
  listSchedules,
  saveAgentTask,
  saveSchedule
} from '@/lib/agent/store'
import { getCapabilities } from '@/lib/agent/worker/capabilities'

export const maxDuration = 120

// Scheduler-compatible heartbeat (Vercel Cron or any external scheduler).
// Finds active background tasks, detects stale workers/jobs, recovers
// what is recoverable, advances recurring schedules and writes real feed
// events. Stateless per invocation — all state lives in Firestore.
// Auth: when AGENT_CRON_SECRET is set, the caller must present it as a
// Bearer token (Vercel Cron convention); otherwise allowed with a warning
// (local/dev use).
export async function GET(req: Request) {
  return handleHeartbeat(req)
}

export async function POST(req: Request) {
  return handleHeartbeat(req)
}

async function handleHeartbeat(req: Request): Promise<NextResponse> {
  const required = process.env.AGENT_CRON_SECRET?.trim()
  if (required) {
    const header = req.headers.get('authorization') ?? ''
    if (header !== `Bearer ${required}`) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
    }
  } else {
    console.warn(
      '[agent] heartbeat without AGENT_CRON_SECRET — dev only, set the secret in production.'
    )
  }

  const capabilities = getCapabilities()
  const report = {
    at: Date.now(),
    schedulerActive: capabilities.heartbeatActive,
    tasksChecked: 0,
    tasksRecovered: 0,
    tasksMarkedStale: 0,
    schedulesAdvanced: 0,
    schedulesDue: 0,
    note: capabilities.heartbeatActive
      ? 'ok'
      : 'no scheduler configured — heartbeat ran on demand only'
  }

  try {
    // NOTE: heartbeat is user-scoped data; without a scheduler identity
    // we cannot enumerate users. When invoked by Vercel Cron, pass
    // ?uid=<userId> per scheduled user (documented contract).
    const uid = new URL(req.url).searchParams.get('uid')
    if (!uid) {
      return NextResponse.json({ success: true, report })
    }

    const active = await listActiveAgentTasks(uid)
    report.tasksChecked = active.length
    const now = Date.now()
    for (const task of active) {
      const age = now - (task.updatedAt || task.createdAt || now)
      // Stale: no update for >30 min while supposedly active.
      if (age > 30 * 60 * 1000) {
        const recovered = { ...task, state: 'FAILED' as const, updatedAt: now }
        await saveAgentTask(uid, recovered).catch(() => {})
        await appendFeed(uid, {
          kind: 'task',
          text: `Tâche abandonnée (sans activité) : ${task.title.slice(0, 140)}`
        }).catch(() => {})
        report.tasksMarkedStale += 1
      }
    }

    const schedules = await listSchedules(uid)
    for (const s of schedules) {
      if (!s.enabled) continue
      const next = s.nextRunAt ?? computeNextRun(s, now) ?? null
      if (next !== s.nextRunAt) {
        await saveSchedule(uid, {
          ...s,
          nextRunAt: next,
          updatedAt: now
        }).catch(() => {})
        report.schedulesAdvanced += 1
      }
      if (typeof next === 'number' && next <= now) {
        report.schedulesDue += 1
        await appendFeed(uid, {
          kind: 'system',
          text: `Échéance : ${s.title.slice(0, 140)}`
        }).catch(() => {})
        // Advance one-shot and interval schedules past due.
        if (s.type === 'once') {
          await saveSchedule(uid, {
            ...s,
            enabled: false,
            nextRunAt: null,
            lastRunAt: now,
            updatedAt: now
          }).catch(() => {})
        } else {
          const following = computeNextRun({ ...s, lastRunAt: now }, now + 1000)
          await saveSchedule(uid, {
            ...s,
            lastRunAt: now,
            nextRunAt: following,
            updatedAt: now
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ success: true, report })
  } catch (err) {
    console.error('[agent] heartbeat failed:', err)
    return NextResponse.json(
      { error: 'Heartbeat impossible.' },
      { status: 502 }
    )
  }
}
