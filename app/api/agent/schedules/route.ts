import { NextResponse } from 'next/server'

import {
  type AgentSchedule,
  computeNextRun,
  newScheduleId,
  validateScheduleInput
} from '@/lib/agent/scheduling'
import {
  deleteSchedule,
  getSchedule,
  listSchedules,
  saveSchedule
} from '@/lib/agent/store'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 60

async function uidOr401(): Promise<string | NextResponse> {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid)
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  return uid
}

export async function GET() {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  try {
    return NextResponse.json({
      success: true,
      schedules: await listSchedules(uid)
    })
  } catch (err) {
    console.error('[agent] schedules list failed:', err)
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  const validated = validateScheduleInput(body ?? {})
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  try {
    const now = Date.now()
    const schedule: AgentSchedule = {
      ...validated.value,
      id: newScheduleId(),
      lastRunAt: null,
      createdAt: now,
      updatedAt: now
    }
    await saveSchedule(uid, schedule)
    return NextResponse.json({ success: true, schedule })
  } catch (err) {
    console.error('[agent] schedules create failed:', err)
    return NextResponse.json({ error: 'Création impossible.' }, { status: 502 })
  }
}

export async function PATCH(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as {
    id?: unknown
    enabled?: unknown
    title?: unknown
  } | null
  if (typeof body?.id !== 'string') {
    return NextResponse.json({ error: 'ID requis.' }, { status: 400 })
  }
  try {
    const existing = await getSchedule(uid, body.id)
    if (!existing) {
      return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
    }
    const updated: AgentSchedule = {
      ...existing,
      title:
        typeof body.title === 'string' && body.title.trim()
          ? body.title.trim().slice(0, 120)
          : existing.title,
      enabled:
        typeof body.enabled === 'boolean' ? body.enabled : existing.enabled,
      nextRunAt: computeNextRun(
        {
          ...existing,
          enabled:
            typeof body.enabled === 'boolean' ? body.enabled : existing.enabled
        },
        Date.now()
      ),
      updatedAt: Date.now()
    }
    await saveSchedule(uid, updated)
    return NextResponse.json({ success: true, schedule: updated })
  } catch (err) {
    console.error('[agent] schedules update failed:', err)
    return NextResponse.json(
      { error: 'Mise à jour impossible.' },
      { status: 502 }
    )
  }
}

export async function DELETE(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 })
  try {
    const ok = await deleteSchedule(uid, id)
    if (!ok)
      return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[agent] schedules delete failed:', err)
    return NextResponse.json(
      { error: 'Suppression impossible.' },
      { status: 502 }
    )
  }
}
