import { cookies } from 'next/headers'

import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage
} from 'ai'

import { getCatalog } from '@/agent/catalog/store'
import { buildAgentTools } from '@/agent/catalog/router'
import {
  AGENT_MAX_HISTORY_TURNS,
  AGENT_MAX_MESSAGE_CHARS,
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MAX_STEPS,
  buildAgentSystemPrompt
} from '@/agent/rules'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import { createModelId } from '@/lib/utils'
import { selectModel } from '@/lib/utils/model-selection'
import { getModel, isProviderEnabled } from '@/lib/utils/registry'

export const maxDuration = 300

const MAX_UI_MESSAGES = AGENT_MAX_HISTORY_TURNS + 2

/**
 * POST /api/agent/chat — the agent loop, Vercel-native and stateless.
 * Body: { messages: UIMessage[] } (useChat default). Streams SSE back.
 * Same providers and same guards as the main chat; tools are READ-only
 * (web_search, calculator, datetime) plus one bounded research subagent.
 */
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null)
    const uiMessages = Array.isArray(
      (body as { messages?: unknown } | null)?.messages
    )
      ? ((body as { messages: UIMessage[] }).messages.slice(-MAX_UI_MESSAGES))
      : []
    if (uiMessages.length === 0) {
      return Response.json({ error: 'messages are required' }, { status: 400 })
    }

    // Same guards as /api/chat: guests only when enabled, with quotas.
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
        { error: 'Selected provider is not enabled' },
        { status: 404 }
      )
    }

    const model = getModel(createModelId(selectedModel))
    // Tool Router (§3, §13): capabilities → catalog discovery → only the
    // relevant executable tools are loaded into this request. The catalog
    // can hold thousands of entries; the prompt never sees more than ~10.
    const lastUserText = [...uiMessages]
      .reverse()
      .find(m => m.role === 'user')
    const requestText =
      lastUserText?.parts
        ?.filter(
          (p): p is { type: 'text'; text: string } => p.type === 'text'
        )
        .map(p => p.text)
        .join('\n')
        .slice(0, AGENT_MAX_MESSAGE_CHARS) ?? ''
    const { index } = await getCatalog()
    const { tools } = buildAgentTools(index, requestText, model)
    const result = streamText({
      model,
      system: buildAgentSystemPrompt(),
      messages: await convertToModelMessages(uiMessages),
      tools,
      stopWhen: stepCountIs(AGENT_MAX_STEPS),
      maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS
    })
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Agent chat API error:', error)
    return Response.json(
      { error: 'Error processing your request' },
      { status: 500 }
    )
  }
}
