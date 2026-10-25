'use client'

import { useMemo, useRef } from 'react'

import {
  type ActionEvent,
  buildMessage,
  BuiltinActionType,
  Renderer
} from '@openuidev/react-lang'
import { type AssistantMessage, useThread } from '@openuidev/react-ui'
import { Copy, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { isOpenUILangResponse } from '@/lib/openui/content-format'
import { pageLibrary } from '@/lib/openui/page-library'
import {
  extractOpenUIResponse,
  splitOpenUIResponses
} from '@/lib/openui/response'
import type { OpenUISearchCall } from '@/lib/openui/search-metadata'
import { splitOpenUISearchMetadata } from '@/lib/openui/search-metadata'
import type { SearchResultItem } from '@/lib/types'
import type { ToolPart } from '@/lib/types/ai'
import { processCitations } from '@/lib/utils/citation'

import { runLibraryAction } from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/actions'

import { useArtifact } from './artifact/artifact-context'
import { CitationProvider } from './openui/citation-context'
import { MarkdownMessage } from './openui/message'
import { SourceFavicons } from './openui/source-favicons'
import { useSettledOpenUIProgram } from './openui/use-settled-opui-program'

// Keyframes `sd-fadeIn` + `[data-sd-animate]` rules: same stylesheet the
// Streamdown Markdown path uses so the rich-UI blocks can fade in too.
import 'streamdown/styles.css'

/**
 * Renders an OpenUI Lang block with a fade-in entry while it streams, like
 * the Streamdown Markdown path. The container keeps a stable key so the
 * animation plays once when the run starts and is never re-triggered per
 * chunk — no visual latency is added to the stream.
 */
function RichBlock({
  response,
  isStreaming,
  onAction
}: {
  response: string
  isStreaming: boolean
  onAction: (event: ActionEvent) => void
}) {
  return (
    <div
      data-sd-animate
      style={{
        animation: isStreaming ? 'sd-fadeIn 200ms ease-out both' : 'none'
      }}
    >
      <RichBlockRenderer
        response={response}
        isStreaming={isStreaming}
        onAction={onAction}
      />
    </div>
  )
}

/**
 * Renderer wrapper that hardens the settled result:
 * - while streaming: the throttle keeps the render smooth and the Renderer
 *   builds the page progressively (best-effort parsing is streaming-native);
 * - at settle: the program goes through the repair/salvage ladder
 *   (repairOpenUIProgram + the real Lang parser) so the page ALWAYS renders
 *   — never a blank frame, never raw source code.
 */
function RichBlockRenderer({
  response,
  isStreaming,
  onAction
}: {
  response: string
  isStreaming: boolean
  onAction: (event: ActionEvent) => void
}) {
  const program = useSettledOpenUIProgram(response, isStreaming, pageLibrary)

  return (
    <Renderer
      response={program}
      library={pageLibrary}
      isStreaming={isStreaming}
      onAction={onAction}
      onError={errors => {
        // Parse/runtime diagnostics for dev tooling only — the UI keeps
        // rendering the repaired page, so this is never user-facing.
        console.error('OpenUI response validation errors:', errors)
      }}
    />
  )
}

function continueMessage(event: ActionEvent): string {
  const context: unknown[] = [`User clicked: ${event.humanFriendlyMessage}`]
  const actionContext = event.params?.context
  if (event.formState || actionContext !== undefined) {
    context.push(event.formState ?? {})
  }
  if (actionContext !== undefined) context.push(actionContext)

  const built = buildMessage({
    content: event.humanFriendlyMessage,
    context
  })
  return event.humanFriendlyMessage
    ? built
    : built.slice(built.indexOf('\n') + 1)
}

/**
 * OpenUI assistant message that reuses the classic /classic rendering:
 * - MarkdownMessage (Streamdown + nexus-ui citation chips via Citing) for
 *   plain Markdown answers, with inline citations and hover cards.
 * - The openui-lang Renderer for structured answers, wrapped in the same
 *   CitationProvider so Markdown blocks inside programs get the chips too.
 * - The classic sources footer (SourceFavicons + count) that opens the
 *   existing right-hand results panel (SearchArtifactContent via useArtifact).
 */
export function OpenUIAssistantMessage({
  message,
  isStreaming
}: {
  message: AssistantMessage
  isStreaming: boolean
}) {
  const answerRef = useRef<HTMLDivElement>(null)
  const messages = useThread(state => state.messages)
  const processMessage = useThread(state => state.processMessage)
  const setMessages = useThread(state => state.setMessages)
  const { open: openArtifact } = useArtifact()

  // The route streams the search-metadata envelope as the FIRST chunk of the
  // answer, so the results are known from the very first delta: inline [n]
  // citations resolve into clickable citation components (with their
  // favicon) while the answer is still streaming. The envelope is stripped
  // from the displayed text.
  const { content, envelopeSearch } = useMemo(() => {
    try {
      const parsed = splitOpenUISearchMetadata(message.content ?? '')
      return {
        content: parsed.content,
        envelopeSearch: parsed.metadata['preloaded-search'] as
          | OpenUISearchCall
          | undefined
      }
    } catch (error) {
      console.error('Unable to read OpenUI search citations:', error)
      return { content: message.content ?? '', envelopeSearch: undefined }
    }
  }, [message.content])

  const searchResults = useMemo(
    () => envelopeSearch?.results ?? [],
    [envelopeSearch]
  )
  const searchQuery = envelopeSearch?.query ?? ''
  const searchImages = useMemo(
    () => envelopeSearch?.images ?? [],
    [envelopeSearch]
  )

  const citationMaps = useMemo(() => {
    if (!searchResults || searchResults.length === 0) return undefined
    const citationMap: Record<number, SearchResultItem> = {}
    searchResults.forEach((result, index) => {
      citationMap[index + 1] = result
    })
    return { 'preloaded-search': citationMap }
  }, [searchResults])

  // The same synthetic tool part the classic chat surfaces for preloaded
  // searches, so the right-hand panel renders web results and images.
  const searchPart = useMemo<ToolPart<'search'> | undefined>(() => {
    if (!searchResults || searchResults.length === 0) return undefined
    return {
      type: 'tool-search',
      toolCallId: 'preloaded-search',
      state: 'output-available',
      input: {
        query: searchQuery,
        type: 'optimized',
        content_types: ['web'],
        max_results: 10,
        search_depth: 'basic',
        include_domains: [],
        exclude_domains: []
      },
      output: {
        state: 'complete',
        query: searchQuery,
        results: searchResults,
        images: searchImages,
        number_of_results: searchResults.length,
        toolCallId: 'preloaded-search'
      }
    }
  }, [searchResults, searchQuery, searchImages])

  // ChatGPT Intelligent UI rule: basic prompts keep the text-only format.
  // The model may answer in plain Markdown; only OpenUI Lang programs go
  // through the Renderer, everything else renders as classic prose.
  const isLangResponse = useMemo(() => {
    if (!isOpenUILangResponse(content)) return false
    // The fence signal alone is too weak — a text answer may QUOTE a
    // ```openui sample inside a code block. A real pure program's body
    // starts with the `root =` statement; only then route it to the
    // Renderer ("mal appliqué" guard). Bare (fence-less) programs already
    // passed OPENUI_ROOT_RE, so they stay true.
    const unfenced = extractOpenUIResponse(content)
    return unfenced ? /^\s*root\s*=/.test(unfenced) : true
  }, [content])
  const renderedLang = useMemo(() => {
    if (!isLangResponse) return content
    // Pure program wrapped in a ```openui fence: strip it before the Renderer
    // — it parses the RAW program, so the fence markers would themselves be
    // parsed as opui-lang source and break validation ("mal appliqué").
    // Models oscillate between fence-wrapped and bare programs mid-stream.
    const unfenced = extractOpenUIResponse(content)
    return processCitations(unfenced ?? content, citationMaps ?? {})
  }, [citationMaps, content, isLangResponse])

  // Découpe la réponse en segments Markdown / OpenUI Lang. Les cas purs
  // (tout Markdown ou tout programme) conservent leur rendu actuel. Une
  // réponse mêlant les deux est rendue segment par segment : le Renderer
  // OpenUI ne conserve que ce qui est joignable depuis `root`, donc sans
  // cela la prose autour d'un bloc ```openui disparaît silencieusement —
  // et un programme invalide en cours de stream rend un blanc.
  const segments = useMemo(() => splitOpenUIResponses(content), [content])
  const hasOpenUI = useMemo(
    () => segments.some(segment => segment.type === 'openui'),
    [segments]
  )
  const mixed = hasOpenUI && segments.length > 1

  async function copyAnswer() {
    const visibleAnswer = answerRef.current?.innerText.trim()
    if (!visibleAnswer) {
      toast.error("Il n'y a pas de réponse à copier.")
      return
    }

    try {
      await navigator.clipboard.writeText(visibleAnswer)
      toast.success('Réponse copiée.')
    } catch (error) {
      console.error('Unable to copy the OpenUI answer:', error)
      toast.error('Impossible de copier la réponse.')
    }
  }

  async function regenerateAnswer() {
    const assistantIndex = messages.findIndex(item => item.id === message.id)
    const userIndex = messages
      .slice(0, assistantIndex)
      .findLastIndex(item => item.role === 'user')
    const userMessage = messages[userIndex]

    if (
      assistantIndex < 0 ||
      userIndex < 0 ||
      !userMessage ||
      userMessage.role !== 'user' ||
      (typeof userMessage.content !== 'string' &&
        !Array.isArray(userMessage.content))
    ) {
      toast.error('Impossible de retrouver la question à régénérer.')
      return
    }

    setMessages(
      messages.filter((_, index) => index < userIndex || index > assistantIndex)
    )
    await processMessage({
      role: 'user',
      content: userMessage.content
    })
  }

  function openSearchResults() {
    if (searchPart) openArtifact(searchPart)
  }

  function handleAction(event: ActionEvent) {
    if (event.type === BuiltinActionType.ContinueConversation) {
      void processMessage({
        role: 'user',
        content: continueMessage(event)
      })
      return
    }

    if (event.type === BuiltinActionType.OpenUrl) {
      const value = event.params.url
      if (typeof value !== 'string') {
        console.error('OpenUI attempted to open an invalid URL.')
        return
      }
      try {
        const url = new URL(value)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          console.error('OpenUI attempted to open an unsupported URL.')
          return
        }
        window.open(url.href, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('OpenUI attempted to open an invalid URL:', error)
      }
      return
    }

    const action = runLibraryAction(event)
    if (action) {
      void action.then(success => {
        if (!success) toast.error("Impossible d'effectuer cette action.")
      })
    }
  }

  return (
    <div className="openui-answer-with-actions">
      <div ref={answerRef} className="openui-answer">
        <CitationProvider citationMaps={citationMaps}>
          {isLangResponse && !mixed ? (
            <RichBlock
              response={renderedLang}
              isStreaming={isStreaming}
              onAction={handleAction}
            />
          ) : (
            <>
              {segments.map((segment, index) =>
                segment.type === 'openui' ? (
                  <RichBlock
                    key={`openui-${index}`}
                    response={processCitations(
                      segment.content,
                      citationMaps ?? {}
                    )}
                    isStreaming={isStreaming}
                    onAction={handleAction}
                  />
                ) : (
                  <MarkdownMessage
                    key={`markdown-${index}`}
                    message={segment.content}
                    citationMaps={citationMaps}
                    isStreaming={isStreaming}
                  />
                )
              )}
            </>
          )}
        </CitationProvider>
      </div>
      {!isStreaming && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {searchResults.length > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={openSearchResults}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openSearchResults()
                }
              }}
              className="flex cursor-pointer items-center gap-1.5 pl-1 text-muted-foreground text-xs transition-opacity hover:opacity-80"
              title="Ouvrir les résultats de recherche"
            >
              <SourceFavicons results={searchResults} maxDisplay={5} />
              <span>{searchResults.length} sources</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void regenerateAnswer()}
            aria-label="Régénérer la réponse"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Régénérer
          </button>
          <button
            type="button"
            onClick={() => void copyAnswer()}
            aria-label="Copier la réponse"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Copy className="size-3.5" />
            Copier
          </button>
        </div>
      )}
    </div>
  )
}
