'use client'

import { useMemo, useRef, useState } from 'react'

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
  type OpenUISearchCall,
  splitOpenUISearchMetadata} from '@/lib/openui/search-metadata'
import type { SearchResultItem } from '@/lib/types'
import type { ToolPart } from '@/lib/types/ai'
import { processCitations } from '@/lib/utils/citation'

import { runLibraryAction } from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/actions'

import { useArtifact } from './artifact/artifact-context'
import { CitationProvider } from './citation-context'
import { MarkdownMessage } from './message'
import { SearchSection } from './search-section'
import { SourceFavicons } from './source-favicons'

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
  const [searchSectionOpen, setSearchSectionOpen] = useState(false)
  const messages = useThread(state => state.messages)
  const processMessage = useThread(state => state.processMessage)
  const setMessages = useThread(state => state.setMessages)
  const { open: openArtifact } = useArtifact()

  const { content, search } = useMemo(() => {
    try {
      const parsed = splitOpenUISearchMetadata(message.content ?? '')
      return {
        content: parsed.content,
        search: parsed.metadata['preloaded-search'] as
          | OpenUISearchCall
          | undefined
      }
    } catch (error) {
      console.error('Unable to read OpenUI search citations:', error)
      return { content: message.content ?? '', search: undefined }
    }
  }, [message.content])

  const citationMaps = useMemo(() => {
    if (!search || search.results.length === 0) return undefined
    const citationMap: Record<number, SearchResultItem> = {}
    search.results.forEach((result, index) => {
      citationMap[index + 1] = result
    })
    return { 'preloaded-search': citationMap }
  }, [search])

  const searchResults = useMemo(() => search?.results ?? [], [search])

  // The same synthetic tool part the classic chat surfaces for preloaded
  // searches, so the right-hand panel renders web results and images.
  const searchPart = useMemo<ToolPart<'search'> | undefined>(() => {
    if (!search || searchResults.length === 0) return undefined
    return {
      type: 'tool-search',
      toolCallId: 'preloaded-search',
      state: 'output-available',
      input: {
        query: search.query,
        type: 'optimized',
        content_types: ['web'],
        max_results: 10,
        search_depth: 'basic',
        include_domains: [],
        exclude_domains: []
      },
      output: {
        state: 'complete',
        query: search.query,
        results: searchResults,
        images: search.images ?? [],
        number_of_results: searchResults.length,
        toolCallId: 'preloaded-search'
      }
    }
  }, [search, searchResults])

  // ChatGPT Intelligent UI rule: basic prompts keep the text-only format.
  // The model may answer in plain Markdown; only OpenUI Lang programs go
  // through the Renderer, everything else renders as classic prose.
  const isLangResponse = isOpenUILangResponse(content)
  const renderedLang = useMemo(
    () =>
      isLangResponse ? processCitations(content, citationMaps ?? {}) : content,
    [citationMaps, content, isLangResponse]
  )

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
      toast.error("Impossible de retrouver la question à régénérer.")
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
          {isLangResponse ? (
            <Renderer
              response={renderedLang}
              library={pageLibrary}
              isStreaming={isStreaming}
              onAction={handleAction}
              onError={errors => {
                console.error('OpenUI response validation errors:', errors)
              }}
            />
          ) : (
            <MarkdownMessage
              message={content}
              citationMaps={citationMaps}
              isStreaming={isStreaming}
            />
          )}
        </CitationProvider>
      </div>
      {/* The exact classic /classic search component: header with query, result
          count and favicons, an expandable Sources list + image grid, and the
          inspect button that opens the right-hand results panel. */}
      {searchPart && (
        <SearchSection
          tool={searchPart}
          isOpen={searchSectionOpen}
          onOpenChange={setSearchSectionOpen}
        />
      )}
      {!isStreaming && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
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
        </div>
      )}
    </div>
  )
}
