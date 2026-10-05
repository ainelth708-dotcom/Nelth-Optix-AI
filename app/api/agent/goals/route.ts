import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal
} from '@/lib/agent/store'

export const maxDuration = 30

async function uidOr401(): Promise<string | NextResponse> {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  return uid
}

export async function GET() {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  try {
    return NextResponse.json({ success: true, goals: await listGoals(uid) })
  } catch (err) {
    console.error('[agent] goals list failed:', err)
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as {
    title?: unknown
    objective?: unknown
  } | null
  try {
    const goal = await createGoal(uid, {
      title: typeof body?.title === 'string' ? body.title : '',
      objective: typeof body?.objective === 'string' ? body.objective : ''
    })
    return NextResponse.json({ success: true, goal })
  } catch (err) {
    console.error('[agent] goals create failed:', err)
    return NextResponse.json({ error: 'Création impossible.' }, { status: 502 })
  }
}

export async function PATCH(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as {
    id?: unknown
    title?: unknown
    objective?: unknown
    status?: unknown
    progress?: unknown
  } | null
  if (typeof body?.id !== 'string') {
    return NextResponse.json({ error: 'ID requis.' }, { status: 400 })
  }
  try {
    const goal = await updateGoal(uid, body.id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      objective: typeof body.objective === 'string' ? body.objective : undefined,
      status:
        body.status === 'active' || body.status === 'paused' || body.status === 'done'
          ? body.status
          : undefined,
      progress: typeof body.progress === 'number' ? body.progress : undefined
    })
    if (!goal) return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
    return NextResponse.json({ success: true, goal })
  } catch (err) {
    console.error('[agent] goals update failed:', err)
    return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 502 })
  }
}

export async function DELETE(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 })
  try {
    const ok = await deleteGoal(uid, id)
    if (!ok) return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[agent] goals delete failed:', err)
    return NextResponse.json({ error: 'Suppression impossible.' }, { status: 502 })
  }
}
