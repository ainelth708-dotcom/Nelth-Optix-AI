import { cookies } from 'next/headers'

import { generateText } from 'ai'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import { createModelId } from '@/lib/utils'
import { selectModel } from '@/lib/utils/model-selection'
import { getModel, isProviderEnabled } from '@/lib/utils/registry'

export const maxDuration = 120

const MAX_MESSAGE_CHARS = 4000
const MAX_HISTORY_TURNS = 20
const MAX_OUTPUT_TOKENS = 1500

// Backend interne de l'agent navigateur (/agent) : mêmes providers et mêmes
// gardes que le chat principal, avec le system prompt de l'agent navigateur
// (agent-browser/instructions.md). Réponse JSON simple, sans streaming.
const AGENT_SYSTEM_PROMPT = `You are Nelth Agent, the browsing agent inside Nelth-IA.
Answer in the user's language (French by default).
You have NO code-execution tools and NO browser_navigate function. NEVER emit XML like <dots_function_call>, <invoke>, <parameter>, or any tool-call markup: it is not executed and must never appear in your reply.
To open a page in the live browser panel next to this chat, simply write its full https URL as plain text (e.g. https://www.youtube.com/). The interface opens the first URL it finds in your reply.
When the user shares a URL, acknowledge it, explain what you would look for, summarize, and report concrete findings (titles, text, numbers) — never vague summaries.
When there is no URL, help with the task directly and say which page to open if browsing would help.
Keep answers focused and reasonably short.`

type IncomingTurn = {
  role: 'user' | 'assistant'
  text: string
}

function sanitizeTurns(value: unknown): IncomingTurn[] {
  if (!Array.isArray(value)) return []
  const turns: IncomingTurn[] = []
  for (const item of value) {
    if (
      typeof item === 'object' &&
      item !== null &&
      ((item as { role?: unknown }).role === 'user' ||
        (item as { role?: unknown }).role === 'assistant') &&
      typeof (item as { text?: unknown }).text === 'string'
    ) {
      turns.push({
        role: (item as { role: 'user' | 'assistant' }).role,
        text: (item as { text: string }).text.slice(0, MAX_MESSAGE_CHARS)
      })
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS)
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null)
    const message =
      typeof (body as { message?: unknown } | null)?.message === 'string'
        ? ((body as { message: string }).message.trim().slice(
            0,
            MAX_MESSAGE_CHARS
          ))
        : ''
    if (!message) {
      return Response.json({ error: 'message is required' }, { status: 400 })
    }
    const history = sanitizeTurns(
      (body as { history?: unknown } | null)?.history
    )

    // Mêmes gardes que /api/chat : invités seulement si activés, avec quota.
    const userId = await getCurrentUserId()
    const isGuest = !userId
    if (isGuest && process.env.ENABLE_GUEST_CHAT !== 'true') {
      return Response.json(
        { error: 'Authentication required', authRequired: true },
        { status: 401 }
      )
    }
    if (isGuest) {
      const forwardedFor = req.headers.get('x-forwarded-for') || ''
      const ip =
        forwardedFor.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null
      const guestLimitResponse = await checkAndEnforceGuestLimit(ip)
      if (guestLimitResponse) return guestLimitResponse
    } else if (userId) {
      const overallLimitResponse =
        await checkAndEnforceOverallChatLimit(userId)
      if (overallLimitResponse) return overallLimitResponse
    }

    const cookieStore = await cookies()
    const selectedModel = await selectModel({
      searchMode: 'quick',
      cookieStore
    })
    if (!selectedModel) {
      return Response.json(
        { error: 'No enabled model is available' },
        { status: 503 }
      )
    }
    if (!isProviderEnabled(selectedModel.providerId)) {
      return Response.json(
        { error: `Selected provider is not enabled` },
        { status: 404 }
      )
    }

    const { text } = await generateText({
      model: getModel(createModelId(selectedModel)),
      system: AGENT_SYSTEM_PROMPT,
      messages: [
        ...history.map(turn => ({
          role: turn.role as 'user' | 'assistant',
          content: turn.text
        })),
        { role: 'user' as const, content: message }
      ],
      maxOutputTokens: MAX_OUTPUT_TOKENS
    })

    return Response.json({
      text,
      model: `${selectedModel.providerId}:${selectedModel.id}`
    })
  } catch (error) {
    console.error('Agent chat API error:', error)
    return Response.json(
      { error: 'Error processing your request' },
      { status: 500 }
    )
  }
}
