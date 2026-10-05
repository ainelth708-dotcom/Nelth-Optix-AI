// Server-sent events helper for agent streams (shared by run/decide).
import type { AgentRunEvent } from './orchestrator'

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
          message: err instanceof Error ? err.message : 'Échec de la tâche.'
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
