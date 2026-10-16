'use client'

import { useMemo, useRef } from 'react'

import {
  type ActionEvent,
  buildMessage,
  BuiltinActionType,
  Renderer
} from '@openuidev/react-lang'
import { type AssistantMessage, useThread } from '@openuidev/react-ui'
import { Copy, Image as ImageIcon, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { Components } from 'streamdown'
import { Streamdown } from 'streamdown'

import { isOpenUILangResponse } from '@/lib/openui/content-format'
import { library } from '@/lib/openui/library'
import {
  type OpenUISearchMetadata,
  splitOpenUISearchMetadata} from '@/lib/openui/search-metadata'

import {
  getOpenUISources,
  type OpenUISource,
  OpenUISourcesProvider,
  useOpenUICitationPanel} from '@/components/openui-citation-context'

import { runLibraryAction } from '../open-intelligent-ui-main/open-intelligent-ui-main/src/lib/actions'

import { defaultComponents } from './assistant-ui/markdown-text'

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

function SourceChip({
  source,
  sources,
  onOpen
}: {
  source: OpenUISource
  sources: OpenUISource[]
  onOpen: (sources: OpenUISource[], activeId?: string) => void
}) {
  const label = source.id.split(':').pop() ?? ''
  const isImage = source.kind === 'image'
  return (
    <button
      type="button"
      onClick={() => onOpen(sources, source.id)}
      aria-label={`Open source ${label}: ${source.title}`}
      title={source.title}
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 bg-muted px-1.5 align-middle text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
    >
      {isImage ? <ImageIcon className="size-3" /> : label}
    </button>
  )
}

export function OpenUIAssistantMessage({
  message,
  isStreaming,
  onAction
}: {
  message: AssistantMessage
  isStreaming: boolean
  onAction?: (event: ActionEvent) => void
}) {
  const answerRef = useRef<HTMLDivElement>(null)
  const messages = useThread(state => state.messages)
  const processMessage = useThread(state => state.processMessage)
  const setMessages = useThread(state => state.setMessages)
  const { openCitationPanel } = useOpenUICitationPanel()
  const { content, metadata } = useMemo(() => {
    try {
      return splitOpenUISearchMetadata(message.content ?? '')
    } catch (error) {
      console.error('Unable to read OpenUI search citations:', error)
      return {
        content: message.content ?? '',
        metadata: {} as OpenUISearchMetadata
      }
    }
  }, [message.content])
  const sources = useMemo(() => getOpenUISources(metadata), [metadata])
  const markdownComponents = useMemo<Components>(
    () => ({
      ...defaultComponents,
      a: ({ href, children, ...props }) => {
        const source =
          typeof href === 'string'
            ? sources.find(item => item.kind === 'web' && item.url === href)
            : undefined
        if (source) {
          return (
            <button
              type="button"
              onClick={() => openCitationPanel(sources, source.id)}
              className="inline-flex items-center rounded-sm text-accent-foreground underline decoration-current/40 underline-offset-2 hover:decoration-current"
            >
              {children}
            </button>
          )
        }

        if (typeof href !== 'string' || !/^(https?:\/\/|\/|#)/i.test(href)) {
          return <>{children}</>
        }

        return (
          <a
            {...props}
            href={href}
            target={/^https?:\/\//i.test(href) ? '_blank' : undefined}
            rel={/^https?:\/\//i.test(href) ? 'noopener noreferrer' : undefined}
            className="text-accent-foreground underline decoration-current/40 underline-offset-2 hover:decoration-current"
          >
            {children}
          </a>
        )
      }
    }),
    [openCitationPanel, sources]
  )
  // ChatGPT Intelligent UI rule: basic prompts keep the text-only format.
  // The model may answer in plain Markdown; only OpenUI Lang programs go
  // through the Renderer, everything else renders as classic prose.
  const isLangResponse = isOpenUILangResponse(content)

  async function copyAnswer() {
    const visibleAnswer = answerRef.current?.innerText.trim()
    if (!visibleAnswer) {
      toast.error('There is no answer to copy.')
      return
    }

    try {
      await navigator.clipboard.writeText(visibleAnswer)
      toast.success('Answer copied.')
    } catch (error) {
      console.error('Unable to copy the OpenUI answer:', error)
      toast.error('Could not copy the answer.')
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
      toast.error('Could not find the question to regenerate.')
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
        if (!success) toast.error('Could not complete this action.')
      })
      return
    }
    onAction?.(event)
  }

  return (
    <div className="openui-answer-with-actions">
      <div ref={answerRef} className="openui-answer">
        <OpenUISourcesProvider metadata={metadata}>
          {isLangResponse ? (
            <Renderer
              response={content}
              library={library}
              isStreaming={isStreaming}
              onAction={handleAction}
              onError={errors => {
                console.error('OpenUI response validation errors:', errors)
              }}
            />
          ) : (
            <div className="prose-sm prose-neutral prose-a:text-accent-foreground/50">
              <Streamdown
                mode={isStreaming ? 'streaming' : 'static'}
                components={markdownComponents}
              >
                {content}
              </Streamdown>
            </div>
          )}
        </OpenUISourcesProvider>
      </div>
      {!isStreaming && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => void regenerateAnswer()}
            aria-label="Regenerate answer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Regenerate
          </button>
          <button
            type="button"
            onClick={() => void copyAnswer()}
            aria-label="Copy answer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Copy className="size-3.5" />
            Copy
          </button>
          {sources.map(source => (
            <SourceChip
              key={source.id}
              source={source}
              sources={sources}
              onOpen={openCitationPanel}
            />
          ))}
          {sources.length > 0 && (
            <button
              type="button"
              onClick={() => openCitationPanel(sources)}
              aria-label={`Open ${sources.length} sources`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sources
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {sources.length}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
