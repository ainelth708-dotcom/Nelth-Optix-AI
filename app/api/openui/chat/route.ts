import { cookies } from 'next/headers'

import { generateSystemPrompt, type LibrarySpec } from '@openuidev/lang-core'
import { type ModelMessage, stepCountIs, streamText } from 'ai'

import {
  CONVERSATIONAL_BEHAVIOR,
  OPENUI_RESPONSE_ROUTING_POLICY
} from '@/lib/agents/prompts/conversational-behavior'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  appendOpenUISearchMetadata,
  type OpenUISearchCall,
  type OpenUISearchMetadata
} from '@/lib/openui/search-metadata'
import { checkAndEnforceAdaptiveLimit } from '@/lib/rate-limit/adaptive-limit'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import {
  ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE,
  isAdaptiveModeAuthBlocked
} from '@/lib/search-mode-availability'
import { createSearchTool } from '@/lib/tools/search'
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
const OPENUI_PREAMBLE = `You are Nelth-IA, a natural and helpful conversational assistant. Choose the response format from the user's intent, like ChatGPT's Intelligent UI does: for greetings, thanks, small talk, and simple questions or short factual answers, reply in plain Markdown text — never wrap those in UI components. Use valid openui-lang code with the supplied component library only when visuals, structure, or interactivity genuinely add value (plans, itineraries, comparisons, explanations of how things work, calculators, interactive tools). Never mix raw Markdown inside openui-lang. When you answer in plain Markdown after a web or image search, add a short "Sources" section at the end with Markdown links to the real result URLs.`

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
      'Respond in the same language as the user.',
      'Use web_search when the user explicitly asks to search the web or when current, changing, niche, or uncertain facts need verification. Do not use either search tool for greetings, acknowledgements, or stable everyday facts. Use image_search only when the user asks for image results. Search calls are optional: decide from the request instead of searching on every turn.',
      'Ground facts in web_search results. In OpenUI Lang, cite each relevant factual claim inline with SearchCitation(resultNumber, toolCallId), using the exact 1-based result number and toolCallId from that search output. In plain Markdown, cite each relevant claim with a Markdown link [resultNumber](exact result URL) from that output. Never invent citations or imply a search ran when it did not.',
      'For image_search, use returned image URLs verbatim with Image(url, alt). Use SearchImage only for relevant illustrative photos when requested or materially useful.'
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

  const baseSearchTool = createSearchTool(selectedModel)
  const webSearch = {
    ...baseSearchTool,
    description:
      'Search the web for current or requested information. The assistant may choose when this is useful.',
    execute: (
      input: Parameters<NonNullable<typeof baseSearchTool.execute>>[0],
      context: Parameters<NonNullable<typeof baseSearchTool.execute>>[1]
    ) => baseSearchTool.execute?.({ ...input, content_types: ['web'] }, context)
  }
  const imageSearch = {
    ...baseSearchTool,
    description:
      'Search the web for images when the user explicitly asks for image results.',
    execute: (
      input: Parameters<NonNullable<typeof baseSearchTool.execute>>[0],
      context: Parameters<NonNullable<typeof baseSearchTool.execute>>[1]
    ) =>
      baseSearchTool.execute?.({ ...input, content_types: ['image'] }, context)
  }
  const tools = { web_search: webSearch, image_search: imageSearch }

  let result: ReturnType<typeof streamText<typeof tools>>
  try {
    result = streamText({
      model: getModel(selectedModel),
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(4),
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
      const toolItems = new Map<string, string>()
      const toolArguments = new Map<string, string>()
      const finishedToolCalls = new Set<string>()
      const searches: OpenUISearchMetadata = {}
      let answer = ''

      const startToolCall = (toolCallId: string, toolName: string) => {
        if (toolItems.has(toolCallId)) return
        const itemId = `call_${crypto.randomUUID()}`
        toolItems.set(toolCallId, itemId)
        toolArguments.set(toolCallId, '')
        encodeEvent(controller, {
          type: 'response.output_item.added',
          item: {
            id: itemId,
            type: 'function_call',
            call_id: toolCallId,
            name: toolName,
            arguments: ''
          },
          output_index: toolItems.size
        })
      }

      const finishToolCall = (
        toolCallId: string,
        fallbackArguments?: string
      ) => {
        const itemId = toolItems.get(toolCallId)
        if (!itemId || finishedToolCalls.has(toolCallId)) return
        finishedToolCalls.add(toolCallId)
        const argumentsText = toolArguments.get(toolCallId) ?? ''
        const finalArguments =
          argumentsText || fallbackArguments || argumentsText
        encodeEvent(controller, {
          type: 'response.function_call_arguments.done',
          item_id: itemId,
          arguments: finalArguments
        })
      }

      try {
        for await (const event of result.fullStream) {
          if (event.type === 'text-delta') {
            answer += event.text
          } else if (event.type === 'tool-input-start') {
            startToolCall(event.id, event.toolName)
          } else if (event.type === 'tool-input-delta') {
            const itemId = toolItems.get(event.id)
            if (itemId) {
              toolArguments.set(
                event.id,
                `${toolArguments.get(event.id) ?? ''}${event.delta}`
              )
              encodeEvent(controller, {
                type: 'response.function_call_arguments.delta',
                item_id: itemId,
                delta: event.delta
              })
            }
          } else if (event.type === 'tool-input-end') {
            finishToolCall(event.id)
          } else if (event.type === 'tool-call') {
            startToolCall(event.toolCallId, event.toolName)
            finishToolCall(
              event.toolCallId,
              typeof event.input === 'string'
                ? event.input
                : JSON.stringify(event.input)
            )
          } else if (event.type === 'tool-result') {
            const toolCallId = event.toolCallId
            if (
              event.toolName === 'web_search' ||
              event.toolName === 'image_search'
            ) {
              const output = event.output as Partial<OpenUISearchCall> | null
              if (output && typeof output === 'object') {
                searches[toolCallId] = {
                  query: typeof output.query === 'string' ? output.query : '',
                  results: Array.isArray(output.results) ? output.results : [],
                  images: Array.isArray(output.images) ? output.images : []
                }
              }
            }
            encodeEvent(controller, {
              type: 'response.output_item.added',
              item: {
                id: `result_${crypto.randomUUID()}`,
                type: 'function_call_output',
                call_id: toolCallId,
                output: JSON.stringify(event.output)
              },
              output_index: toolItems.size
            })
          } else if (event.type === 'error') {
            throw event.error
          }
        }

        if (!answer.trim()) {
          throw new Error('The model completed without an OpenUI answer.')
        }

        const itemId = `msg_${crypto.randomUUID()}`
        const finalText = appendOpenUISearchMetadata(answer, searches)
        encodeEvent(controller, {
          type: 'response.output_item.added',
          item: {
            id: itemId,
            type: 'message',
            role: 'assistant',
            content: [],
            status: 'in_progress'
          },
          output_index: toolItems.size
        })
        encodeEvent(controller, {
          type: 'response.output_text.delta',
          item_id: itemId,
          output_index: toolItems.size,
          content_index: 0,
          delta: finalText
        })
        encodeEvent(controller, {
          type: 'response.output_text.done',
          item_id: itemId,
          output_index: toolItems.size,
          content_index: 0,
          text: finalText
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
