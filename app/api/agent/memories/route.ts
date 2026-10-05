import { NextResponse } from 'next/server'

import { addMemory, deleteMemory, listMemories } from '@/lib/agent/store'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 30

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
      memories: await listMemories(uid)
    })
  } catch (err) {
    console.error('[agent] memories list failed:', err)
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null
  try {
    const memory = await addMemory(
      uid,
      typeof body?.text === 'string' ? body.text : ''
    )
    return NextResponse.json({ success: true, memory })
  } catch (err) {
    console.error('[agent] memories add failed:', err)
    return NextResponse.json({ error: 'Ajout impossible.' }, { status: 502 })
  }
}

export async function DELETE(req: Request) {
  const uid = await uidOr401()
  if (uid instanceof NextResponse) return uid
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 })
  try {
    const ok = await deleteMemory(uid, id)
    if (!ok)
      return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[agent] memories delete failed:', err)
    return NextResponse.json(
      { error: 'Suppression impossible.' },
      { status: 502 }
    )
  }
}
