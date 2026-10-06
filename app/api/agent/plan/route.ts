import { NextResponse } from 'next/server'

import { needsClarification } from '@/lib/agent/autonomy'
import { planGoal } from '@/lib/agent/orchestrator'

export const maxDuration = 60

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    goal?: unknown
  } | null
  const goal = typeof body?.goal === 'string' ? body.goal.trim() : ''
  if (!goal) {
    return NextResponse.json({ error: 'Objectif requis.' }, { status: 400 })
  }
  if (goal.length > 2000) {
    return NextResponse.json({ error: 'Objectif trop long.' }, { status: 400 })
  }
  // Vague-goal gate: ask first instead of planning garbage that fails
  // verification. Not an error — the UI shows the question card.
  const check = needsClarification(goal)
  if (check.vague) {
    return NextResponse.json({
      success: true,
      clarify: true,
      question: check.question
    })
  }
  try {
    const plan = await planGoal(goal)
    return NextResponse.json({ success: true, plan })
  } catch (err) {
    console.error('[agent] plan failed:', err)
    return NextResponse.json(
      { error: 'La planification a échoué, réessaie.' },
      { status: 502 }
    )
  }
}
