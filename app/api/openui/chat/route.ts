import { cookies } from 'next/headers'

import { generateSystemPrompt, type LibrarySpec } from '@openuidev/lang-core'
import { type ModelMessage, streamText } from 'ai'

import {
  CONVERSATIONAL_BEHAVIOR,
  OPENUI_RESPONSE_ROUTING_POLICY
} from '@/lib/agents/prompts/conversational-behavior'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceAdaptiveLimit } from '@/lib/rate-limit/adaptive-limit'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import {
  ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE,
  isAdaptiveModeAuthBlocked
} from '@/lib/search-mode-availability'
import { SearchMode } from '@/lib/types/search'
import { selectModel } from '@/lib/utils/model-selection'
import { getModel, isProviderEnabled } from '@/lib/utils/registry'

import spec from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/generated/spec.json'
import { promptOptions } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/prompt-options'
import { hasAllowedOrigin } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/same-origin'

export const maxDuration = 300

const MAX_BODY_BYTES = 1_000_000
const MAX_MESSAGES = 60
const MAX_OUTPUT_TOKENS = 16_000
const OPENUI_PREAMBLE = `You are Nelth-IA, a natural and helpful conversational assistant. Your entire response must be valid openui-lang code using the supplied component library; do not output raw Markdown or explanations outside that format.`

const systemPrompt = generateSystemPrompt({
  library: spec as LibrarySpec,
  promptOptions: {
    ...promptOptions,
    preamble: [
      OPENUI_PREAMBLE,
      CONVERSATIONAL_BEHAVIOR,
      OPENUI_RESPONSE_ROUTING_POLICY
    ].join('\n\n'),
    additionalRules: [
      ...(promptOptions.additionalRules ?? []),
      'Respond in the same language as the user.'
    ]
  }
})

function toModelMessages(value: unknown): ModelMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null

  const messages: ModelMessage[] = []
  for (const item of value.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as { role?: unknown; content?: unknown }
    if (candidate.role !== 'user' && candidate.role !== 'assistant') continue

    let content: string
    if (typeof candidate.content === 'string') {
      content = candidate.content
    } else if (Array.isArray(candidate.content)) {
      content = candidate.content
        .flatMap(part =>
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
            ? [part.text]
            : []
        )
        .join('')
    } else {
      continue
    }

    messages.push({ role: candidate.role, content })
  }

  return messages.some(message => message.role === 'user') ? messages : null
}

function encodeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: unknown
) {
  controller.enqueue(
    new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
  )
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return Response.json(
      { error: { message: 'Not allowed.' } },
      { status: 403 }
    )
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return Response.json(
      { error: { message: 'Expected application/json.' } },
      { status: 415 }
    )
  }

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: { message: 'Request body is too large.' } },
      { status: 413 }
    )
  }

  let messages: ModelMessage[] | null
  try {
    messages = toModelMessages(
      (JSON.parse(rawBody) as { messages?: unknown }).messages
    )
  } catch {
    messages = null
  }
  if (!messages) {
    return Response.json(
      { error: { message: 'A non-empty messages array is required.' } },
      { status: 400 }
    )
  }

  const userId = await getCurrentUserId()
  const isGuest = !userId
  const guestChatEnabled = process.env.ENABLE_GUEST_CHAT === 'true'
  if (isGuest && !guestChatEnabled) {
    return Response.json(
      { error: { message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  if (isGuest) {
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const ip =
      forwardedFor.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const guestLimitResponse = await checkAndEnforceGuestLimit(ip)
    if (guestLimitResponse) return guestLimitResponse
  }

  const cookieStore = await cookies()
  const searchModeCookie = cookieStore.get('searchMode')?.value
  let searchMode: SearchMode =
    searchModeCookie === 'adaptive' ? 'adaptive' : 'quick'
  if (isGuest) searchMode = 'quick'

  if (
    isAdaptiveModeAuthBlocked({
      mode: searchMode,
      isGuest,
      isCloudDeployment: process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
    })
  ) {
    return Response.json(
      {
        error: { message: ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE },
        mode: 'adaptive',
        authRequired: true
      },
      { status: 401 }
    )
  }

  const model = await selectModel({ searchMode, cookieStore })
  if (!model || !isProviderEnabled(model.providerId)) {
    return Response.json(
      { error: { message: 'No enabled model is available.' } },
      { status: 503 }
    )
  }

  if (userId) {
    const overallLimitResponse = await checkAndEnforceOverallChatLimit(userId)
    if (overallLimitResponse) return overallLimitResponse

    if (searchMode === 'adaptive') {
      const adaptiveLimitResponse = await checkAndEnforceAdaptiveLimit(userId)
      if (adaptiveLimitResponse) return adaptiveLimitResponse
    }
  }

  const selectedModel = `${model.providerId}:${model.id}`
  console.info(`[OpenUI] Generating with ${selectedModel}`)

  let result: ReturnType<typeof streamText>
  try {
    result = streamText({
      model: getModel(selectedModel),
      system: systemPrompt,
      messages,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: request.signal
    })
  } catch (error) {
    console.error('[OpenUI] Failed to start model generation:', error)
    return Response.json(
      { error: { message: 'The selected model could not start generation.' } },
      { status: 502 }
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const itemId = `msg_${crypto.randomUUID()}`
      try {
        encodeEvent(controller, {
          type: 'response.output_item.added',
          item: {
            id: itemId,
            type: 'message',
            role: 'assistant',
            content: [],
            status: 'in_progress'
          },
          output_index: 0
        })

        let text = ''
        for await (const delta of result.textStream) {
          text += delta
          encodeEvent(controller, {
            type: 'response.output_text.delta',
            item_id: itemId,
            output_index: 0,
            content_index: 0,
            delta
          })
        }

        encodeEvent(controller, {
          type: 'response.output_text.done',
          item_id: itemId,
          output_index: 0,
          content_index: 0,
          text
        })
        encodeEvent(controller, { type: 'response.completed' })
      } catch (error) {
        console.error('[OpenUI] Model stream failed:', error)
        try {
          encodeEvent(controller, {
            type: 'error',
            message:
              'The selected model could not complete the OpenUI response.'
          })
        } catch (enqueueError) {
          console.error(
            '[OpenUI] Could not report the stream failure:',
            enqueueError
          )
        }
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
