import { cookies } from 'next/headers'

import { generateSystemPrompt, type LibrarySpec } from '@openuidev/lang-core'
import { type ModelMessage, smoothStream, streamText } from 'ai'

import {
  CONVERSATIONAL_BEHAVIOR,
  OPENUI_RESPONSE_ROUTING_POLICY
} from '@/lib/agents/prompts/conversational-behavior'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { decideWebSearch } from '@/lib/openui/search-decision'
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
import { search as runWebSearch } from '@/lib/tools/search'
import { SearchMode } from '@/lib/types/search'
import { isPureGreeting } from '@/lib/utils/message-utils'
import { selectModel } from '@/lib/utils/model-selection'
import { getModel, isProviderEnabled } from '@/lib/utils/registry'

import spec from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/generated/spec.json'
import { promptOptions } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/prompt-options'
import { hasAllowedOrigin } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/same-origin'

export const maxDuration = 300

const MAX_BODY_BYTES = 1_000_000
const MAX_MESSAGES = 24
const MAX_HISTORY_CHARS = 72_000
const MAX_OUTPUT_TOKENS = 16_000
const FIRST_TOKEN_TIMEOUT_MS = 60_000
const STALL_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 2
const KEEPALIVE_INTERVAL_MS = 10_000
const SEARCH_PRELOAD_TIMEOUT_MS = 6_000
const OPENUI_PREAMBLE = `You are Nelth-IA, a natural and helpful conversational assistant. Choose the response format from the user's intent, like ChatGPT's Intelligent UI does: for greetings, thanks, small talk, and simple questions or short factual answers, reply in plain Markdown text — never wrap those in UI components. Use valid openui-lang code with the supplied component library only when visuals, structure, or interactivity genuinely add value (plans, itineraries, comparisons, explanations of how things work, calculators, interactive tools). Never mix raw Markdown inside openui-lang. When the conversation provides numbered WEB SEARCH RESULTS, cite each relevant factual claim inline with the matching [n] marker, and in plain Markdown answers add a short "Sources" section at the end with Markdown links to the real result URLs. Never invent citation numbers.`

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
      'Ground factual claims in the numbered WEB SEARCH RESULTS provided in the conversation when they are present: cite each supported claim inline with its exact [n] marker (for example "… [1]."), never invent numbers, and never claim to have searched when no results are provided.'
    ]
  }
})

const FALLBACK_TEXTS: Record<'fr' | 'en', string> = {
  fr: `root = Col([Text("Désolé, je n'ai pas réussi à générer une réponse cette fois-ci. Réessaie dans un instant.")])`,
  en: `root = Col([Text("Sorry, I could not generate a response this time. Please try again in a moment.")])`
}

function detectFallbackLanguage(text: string): 'fr' | 'en' {
  const sample = ` ${text.toLowerCase()} `
  const frenchHits = (
    sample.match(
      /[éèêëàâçîïôùûœ]|\b(je|tu|une|des|est|pas|pour|avec|que|qui|dans|sur|vous|nous)\b/g
    ) ?? []
  ).length
  const englishHits = (
    sample.match(/\b(the|you|and|is|are|for|with|this|what|how|can)\b/g) ?? []
  ).length
  return frenchHits >= englishHits ? 'fr' : 'en'
}

function messageText(message: ModelMessage | undefined): string {
  if (!message || typeof message.content !== 'string') return ''
  return message.content
}

// Stored assistant answers carry a trailing search-metadata envelope for the
// client. Strip it before replaying history to the model.
function stripSearchMetadata(content: string): string {
  return content.replace(/<!--nelth-search:[\s\S]*?-->/g, '').trimEnd()
}

function toModelMessages(value: unknown): ModelMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null

  const parsed: ModelMessage[] = []
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

    content = stripSearchMetadata(content)
    if (content.length === 0) continue

    parsed.push({ role: candidate.role, content })
  }

  if (!parsed.some(message => message.role === 'user')) return null

  const kept: ModelMessage[] = []
  let size = 0
  for (let index = parsed.length - 1; index >= 0; index--) {
    const candidate = parsed[index]
    const length =
      typeof candidate.content === 'string' ? candidate.content.length : 0
    if (kept.length >= 2 && size + length > MAX_HISTORY_CHARS) break
    kept.push(candidate)
    size += length
  }
  kept.reverse()

  return kept
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

  const lastUserText = messageText(
    [...messages].reverse().find(m => m.role === 'user')
  )
  const fallbackText = FALLBACK_TEXTS[detectFallbackLanguage(lastUserText)]

  let activeAttempt: AbortController | undefined
  let clientGone = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const itemId = `msg_${crypto.randomUUID()}`
      let text = ''
      let emitted = false
      let watchdog: ReturnType<typeof setTimeout> | undefined

      const send = (event: unknown) => {
        try {
          encodeEvent(controller, event)
        } catch {}
      }
      const clearWatchdog = () => {
        if (watchdog) {
          clearTimeout(watchdog)
          watchdog = undefined
        }
      }
      const armWatchdog = (timeoutMs: number) => {
        clearWatchdog()
        watchdog = setTimeout(() => activeAttempt?.abort(), timeoutMs)
      }
      const keepalive = setInterval(() => {
        if (text.length > 0) return
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {}
      }, KEEPALIVE_INTERVAL_MS)
      const markStarted = () => {
        if (emitted) return
        emitted = true
        send({
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
      }

      try {
        // Open the HTTP response immediately — the classic-style web search
        // preload below can take up to SEARCH_PRELOAD_TIMEOUT_MS, and waiting
        // for it before returning the Response left the client with zero bytes
        // (and nothing to render) until the model answered.
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {}

        // ChatGPT-, Claude- and Gemini-style search routing: in quick mode the
        // model itself decides whether the turn needs fresh web results, so
        // conversational, coding, writing or knowledge turns skip the search
        // round-trip entirely. Adaptive mode (deep research) always grounds.
        // When a search runs, its results are numbered in the system prompt and
        // the client turns the trailing metadata envelope back into citation
        // chips, the sources footer and the right-hand results panel.
        let preloadedSearch: OpenUISearchCall | undefined
        const shouldSearch =
          lastUserText.trim().length > 0 &&
          !isPureGreeting(lastUserText) &&
          (searchMode === 'adaptive' ||
            (await decideWebSearch({
              model: getModel(selectedModel),
              messages
            })))

        if (shouldSearch) {
          try {
            const searchResult = await Promise.race([
              runWebSearch(lastUserText, 7, 'basic', [], [], ['web']),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error('Preloaded search timeout')),
                  SEARCH_PRELOAD_TIMEOUT_MS
                )
              )
            ])

            if (searchResult?.results?.length) {
              preloadedSearch = {
                query: searchResult.query || lastUserText,
                results: searchResult.results,
                images: searchResult.images ?? []
              }
              console.info(
                `[OpenUI] Preloaded ${preloadedSearch.results.length} search results`
              )
            }
          } catch (searchError) {
            console.warn(
              '[OpenUI] Preloaded search failed or timed out:',
              searchError instanceof Error ? searchError.message : searchError
            )
          }
        }

        if (request.signal.aborted || clientGone) return

        const effectiveSystemPrompt = preloadedSearch
          ? `${systemPrompt}\n\nWEB SEARCH RESULTS (fresh, numbered sources — cite with the matching [n] marker after each claim they support; never invent numbers):\n\n${preloadedSearch.results
              .map(
                (result, index) =>
                  `[${index + 1}] ${result.title}: ${result.url}\n  ${result.content}`
              )
              .join('\n\n')}`
          : systemPrompt

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (request.signal.aborted || clientGone) break

          const attemptAbort = new AbortController()
          activeAttempt = attemptAbort
          const abortAttempt = () => attemptAbort.abort()
          request.signal.addEventListener('abort', abortAttempt, {
            once: true
          })
          armWatchdog(FIRST_TOKEN_TIMEOUT_MS)

          try {
            const result = streamText({
              model: getModel(selectedModel),
              system: effectiveSystemPrompt,
              messages,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              // Same as the classic chat route: re-chunk upstream bursts into
              // word-level deltas so the answer visibly types out even when the
              // gateway delivers the whole completion at once.
              experimental_transform: smoothStream({ chunking: 'word' }),
              abortSignal: attemptAbort.signal
            })

            let attemptText = ''
            for await (const delta of result.textStream) {
              if (typeof delta !== 'string' || delta.length === 0) continue
              markStarted()
              armWatchdog(STALL_TIMEOUT_MS)
              attemptText += delta
              text += delta
              send({
                type: 'response.output_text.delta',
                item_id: itemId,
                output_index: 0,
                content_index: 0,
                delta
              })
            }

            if (attemptText.trim().length > 0) break
            console.warn(
              `[OpenUI] attempt ${attempt} returned an empty response`
            )
          } catch (error) {
            if (!request.signal.aborted) {
              console.warn(
                `[OpenUI] attempt ${attempt} failed:`,
                error instanceof Error ? error.message : error
              )
            }
          } finally {
            request.signal.removeEventListener('abort', abortAttempt)
            clearWatchdog()
            if (activeAttempt === attemptAbort) activeAttempt = undefined
          }

          if (request.signal.aborted || clientGone) break
          if (text.length > 0) break
        }

        if (request.signal.aborted || clientGone) return

        markStarted()
        if (text.trim().length === 0) {
          console.warn(
            '[OpenUI] all attempts failed — sending the graceful fallback response'
          )
          text = fallbackText
          send({
            type: 'response.output_text.delta',
            item_id: itemId,
            output_index: 0,
            content_index: 0,
            delta: text
          })
        } else if (preloadedSearch) {
          const metadata: OpenUISearchMetadata = {
            'preloaded-search': preloadedSearch
          }
          const envelope = appendOpenUISearchMetadata('', metadata)
          if (envelope) {
            text += envelope
            send({
              type: 'response.output_text.delta',
              item_id: itemId,
              output_index: 0,
              content_index: 0,
              delta: envelope
            })
          }
        }

        send({
          type: 'response.output_text.done',
          item_id: itemId,
          output_index: 0,
          content_index: 0,
          text
        })
        send({ type: 'response.completed' })
      } catch (error) {
        console.error('[OpenUI] Unexpected stream failure:', error)
      } finally {
        clearInterval(keepalive)
        clearWatchdog()
        try {
          controller.close()
        } catch {}
      }
    },
    cancel() {
      clientGone = true
      activeAttempt?.abort()
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
