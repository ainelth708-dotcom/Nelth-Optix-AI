import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { runGoalStream, type AgentTranscriptEntry } from '@/lib/agent/orchestrator'
import { agentSseResponse } from '@/lib/agent/sse'
import { appendFeed } from '@/lib/agent/store'

export const maxDuration = 300

function cleanSteps(value: unknown): Array<{ title: string; detail: string }> {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (s): s is { title: unknown; detail?: unknown } =>
        typeof s === 'object' && s !== null
    )
    .map(s => ({
      title: String((s as { title: unknown }).title ?? '').slice(0, 120),
      detail: String((s as { detail?: unknown }).detail ?? '').slice(0, 500)
    }))
    .filter(s => s.title.length > 0)
    .slice(0, 8)
}

function cleanTranscript(value: unknown): AgentTranscriptEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (e): e is { role: unknown; text: unknown } =>
        typeof e === 'object' && e !== null
    )
    .filter(
      e => e.role === 'user' || e.role === 'assistant' || e.role === 'observation'
    )
    .map(e => ({
      role: e.role as AgentTranscriptEntry['role'],
      text: String(e.text ?? '').slice(0, 3000)
    }))
    .slice(-20)
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    goal?: unknown
    steps?: unknown
    transcript?: unknown
    startIndex?: unknown
  } | null
  const goal = typeof body?.goal === 'string' ? body.goal.trim() : ''
  const steps = cleanSteps(body?.steps)
  if (!goal || steps.length === 0) {
    return new Response(JSON.stringify({ error: 'Objectif et étapes requis.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const resume =
    typeof body?.startIndex === 'number'
      ? {
          transcript: cleanTranscript(body?.transcript),
          startIndex: body.startIndex as number
        }
      : undefined

  const uid = await getCurrentUserId().catch(() => null)
  return agentSseResponse(async send => {
    try {
      for await (const event of runGoalStream({ goal, steps, resume })) {
        send(event)
        if (event.type === 'done' && uid) {
          await appendFeed(uid, {
            kind: 'task',
            text: event.completed
              ? `Tâche terminée : ${goal.slice(0, 140)}`
              : `Tâche inachevée : ${goal.slice(0, 140)}`
          }).catch(() => {})
        }
      }
    } catch (err) {
      // Feed the failure too — real activity only.
      if (uid) {
        await appendFeed(uid, {
          kind: 'task',
          text: `Tâche échouée : ${goal.slice(0, 140)}`
        }).catch(() => {})
      }
      throw err
    }
  })
}
