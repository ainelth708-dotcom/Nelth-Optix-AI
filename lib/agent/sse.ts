// Server-sent events helper for agent streams (shared by run/decide).
import type { AgentRunEvent } from './orchestrator'

/**
 * Never leak raw technical errors (zod dumps, stack fragments) to the
 * UI: log them server-side, send a clean French message instead.
 */
function publicErrorMessage(err: unknown): string {
  console.error('[agent] run stream failed:', err)
  const raw = err instanceof Error ? err.message : ''
  if (/^(Objectif|Objectif et étapes|Aucune étape)/.test(raw)) return raw
  if (/network|fetch|timeout|délai|abort/i.test(raw)) {
    return 'Connexion interrompue, réessaie.'
  }
  return 'La tâche a échoué, réessaie.'
}

export function agentSseResponse(
  run: (send: (event: AgentRunEvent) => void) => Promise<void>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: AgentRunEvent) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        await run(send)
      } catch (err) {
        send({
          type: 'error',
          message: publicErrorMessage(err)
        })
      } finally {
        controller.close()
      }
    }
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}
