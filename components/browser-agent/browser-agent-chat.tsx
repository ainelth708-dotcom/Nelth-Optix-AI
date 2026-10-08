'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { AlertCircleIcon, ArrowUp, Square } from 'lucide-react'

import { cn } from '@/lib/utils'

import { BrowserPanel } from './browser-panel'

const AGENT_NAME = 'Nelth Agent'
const BETA_TERMS_HREF =
  'https://vercel.com/docs/release-phases/public-beta-agreement'

type AgentStatus = 'ready' | 'submitted' | 'streaming' | 'error'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

/**
 * True only for an https URL whose host is exactly the live-view host. A
 * startsWith/substring check is unsafe — it also passes
 * `https://live.browser-use.com.evil.com`.
 * (Repris tel quel du template browser-agent-template.)
 */
function isLiveUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'live.browser-use.com'
    )
  } catch {
    return false
  }
}

function extractLiveUrl(messages: readonly ChatMessage[]): string | null {
  let found: string | null = null
  for (const message of messages) {
    const match = message.text.match(
      /https:\/\/live\.browser-use\.com[^\s"'\\]*/
    )
    if (match && isLiveUrl(match[0])) found = match[0]
  }
  return found
}

function extractAnyUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'\\]+/i)
  if (!match) return null
  try {
    const parsed = new URL(match[0])
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      return null
    return match[0]
  } catch {
    return null
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function BrowserAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<AgentStatus>('ready')
  const [error, setError] = useState<string | null>(null)
  const [manualUrl, setManualUrl] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isBusy = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  const autoLiveUrl = useMemo(() => extractLiveUrl(messages), [messages])
  const liveUrl = autoLiveUrl ?? manualUrl

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return

    setError(null)
    setStatus('submitted')
    const userMessage: ChatMessage = { id: createId(), role: 'user', text }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    // Ouvre le panneau navigateur si le message contient une URL
    // (même comportement visuel que le template : split chat + iframe).
    const foundUrl = extractAnyUrl(text)
    if (foundUrl) setManualUrl(foundUrl)

    try {
      setStatus('streaming')
      // Réponse locale — le runtime cloud eve/browser-use sera branché
      // ici dès que BROWSER_USE_API_KEY + eve seront configurés.
      // On garde le même design (conversation + panneau live).
      await new Promise(resolve => setTimeout(resolve, 450))
      const assistantText = foundUrl
        ? `J'ouvre ${foundUrl} dans le navigateur de l'agent (panneau de droite). Décrivez-moi ce que vous voulez y faire : naviguer, lire, extraire, remplir un formulaire…`
        : `Message reçu : « ${text} ».\n\nCollez une URL (ex. https://news.ycombinator.com) pour l'ouvrir dans le navigateur de l'agent, comme dans le template browser-agent. Le runtime cloud (eve + browser-use) sera branché à cette interface dès que les clés seront configurées.`
      setMessages(prev => [
        ...prev,
        { id: createId(), role: 'assistant', text: assistantText }
      ])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return (
    <div className="flex h-dvh">
      <main className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
        {isEmpty ? null : (
          <header className="flex h-14 shrink-0 items-center justify-center gap-3 pl-4 pr-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm text-muted-foreground">
                {AGENT_NAME}
              </span>
              <StatusDot status={status} />
            </span>
            <a
              className="rounded-full border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
              href={BETA_TERMS_HREF}
              rel="noreferrer"
              target="_blank"
            >
              Public preview
            </a>
          </header>
        )}

        {error ? (
          <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Request failed</p>
                <p className="mt-0.5 text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {isEmpty ? null : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
              {messages.map(message =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="ml-auto max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {message.text}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="w-full">
                    <div className="whitespace-pre-wrap text-sm leading-6">
                      {message.text}
                    </div>
                  </div>
                )
              )}
              {isBusy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  L&apos;agent travaille…
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div
          className={cn(
            'mx-auto w-full px-4 sm:px-6',
            isEmpty
              ? 'flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]'
              : 'max-w-3xl shrink-0 pb-6'
          )}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <h1 className="text-5xl font-medium tracking-tighter">
                {AGENT_NAME}
              </h1>
              <a
                className="rounded-full border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
                href={BETA_TERMS_HREF}
                rel="noreferrer"
                target="_blank"
              >
                Public preview
              </a>
              <p className="max-w-md text-sm text-muted-foreground">
                Collez une URL pour l&apos;ouvrir dans le navigateur de
                l&apos;agent, puis décrivez la tâche.
              </p>
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSubmit(e)
                  }
                }}
                placeholder="Send a message…"
                rows={1}
                className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type={isBusy ? 'button' : 'submit'}
                disabled={!isBusy && !input.trim()}
                onClick={
                  isBusy
                    ? () => {
                        setStatus('ready')
                      }
                    : undefined
                }
                aria-label={isBusy ? 'Stop' : 'Send'}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {isBusy ? <Square size={15} /> : <ArrowUp size={16} />}
              </button>
            </div>
          </form>
        </div>
      </main>
      {liveUrl ? (
        <BrowserPanel liveUrl={liveUrl} onNavigate={setManualUrl} />
      ) : null}
    </div>
  )
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === 'submitted' || status === 'streaming'
  const tone =
    status === 'error'
      ? 'bg-destructive'
      : isLive
        ? 'bg-emerald-500'
        : status === 'ready'
          ? 'bg-muted-foreground'
          : 'bg-muted-foreground/50'

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
            tone
          )}
        />
      ) : null}
      <span
        className={cn(
          'relative inline-flex size-1 rounded-full transition-colors',
          tone
        )}
      />
    </span>
  )
}
