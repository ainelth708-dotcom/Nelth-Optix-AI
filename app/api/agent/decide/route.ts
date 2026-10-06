import type { ApprovalDecision } from '@/lib/agent/approvals'
import type { AgentRunState } from '@/lib/agent/autonomy'
import { executeApprovedFetch, runGoalStream } from '@/lib/agent/orchestrator'
import { agentSseResponse } from '@/lib/agent/sse'
import { saveAgentRun } from '@/lib/agent/store'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 300

const DECISIONS: ApprovalDecision[] = [
  'ALLOW_ONCE',
  'ALLOW_SESSION',
  'ALLOW_ALWAYS',
  'DENY'
]

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    call?: unknown
    decision?: unknown
    resume?: unknown
    taskId?: unknown
  } | null

  const call = body?.call as { tool?: unknown; args?: unknown } | undefined
  const decision = body?.decision as ApprovalDecision | undefined
  const resume = body?.resume as
    | {
        goal?: unknown
        steps?: unknown
        transcript?: unknown
        startIndex?: unknown
      }
    | undefined

  if (
    !call ||
    call.tool !== 'fetch' ||
    typeof call.args !== 'object' ||
    call.args === null ||
    !DECISIONS.includes(decision as ApprovalDecision) ||
    typeof resume?.goal !== 'string' ||
    !Array.isArray(resume?.steps)
  ) {
    return new Response(
      JSON.stringify({ error: 'Demande de décision invalide.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (decision === 'DENY') {
    return agentSseResponse(async send => {
      send({
        type: 'done',
        verdict: 'Arrêté : lecture de page refusée par l’utilisateur.',
        completed: false
      })
    })
  }

  // ALLOW_*: execute the single approved fetch server-side, then resume
  // the loop with its observation — same SSE protocol as /api/agent/run.
  return agentSseResponse(async send => {
    const args = call.args as Record<string, unknown>
    const url = typeof args.url === 'string' ? args.url : ''
    let observation: string
    try {
      observation = await executeApprovedFetch(args)
    } catch (err) {
      send({
        type: 'done',
        verdict: `Lecture impossible (${url || 'URL invalide'}) : ${
          err instanceof Error ? err.message : 'échec'
        }.`,
        completed: false
      })
      return
    }
    const transcript = (
      Array.isArray(resume.transcript) ? resume.transcript : []
    ) as Array<{ role: 'user' | 'assistant' | 'observation'; text: string }>
    const steps = (resume.steps as Array<{ title: string; detail: string }>)
      .filter(s => typeof s?.title === 'string')
      .map(s => ({
        title: String(s.title).slice(0, 120),
        detail: String((s as { detail?: unknown }).detail ?? '').slice(0, 500)
      }))
      .slice(0, 8)
    for await (const event of runGoalStream({
      goal: String(resume.goal),
      steps,
      taskId:
        typeof (resume as { taskId?: unknown }).taskId === 'string'
          ? (resume as { taskId: string }).taskId
          : undefined,
      resume: {
        transcript: [
          ...transcript,
          {
            role: 'observation' as const,
            text: `Approved fetch ${url} returned:\n${observation}`.slice(
              0,
              4000
            )
          }
        ],
        startIndex:
          typeof resume.startIndex === 'number' ? resume.startIndex : 0
      },
      persist: async state => {
        const uid = await getCurrentUserId().catch(() => null)
        const tid =
          typeof (resume as { taskId?: unknown }).taskId === 'string'
            ? ((resume as { taskId: string }).taskId as string)
            : null
        if (uid && tid) await saveAgentRun(uid, tid, state).catch(() => {})
      }
    })) {
      send(event)
    }
  })
}
