'use client'

import { useState } from 'react'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import {
  AlertCircleIcon,
  ArrowUp,
  Globe,
  Calculator,
  Clock,
  Users,
  Plus,
  Search,
  Square,
  Wrench
} from 'lucide-react'

import type {
  ArxivData,
  CryptoData,
  CurrencyData,
  DictionaryData,
  GithubData,
  NewsData,
  WeatherData,
  WikipediaData
} from '@/agent/bricks'
import type {
  BookData,
  CountryData,
  EntityData,
  MediaData,
  PackageData
} from '@/agent/adapters'
import { AGENT_NAME } from '@/agent/rules'
import { cn } from '@/lib/utils'

import {
  ArxivCard,
  BookCard,
  CountryCard,
  CryptoCard,
  CurrencyCard,
  DictionaryCard,
  EntityCard,
  GithubCard,
  MediaCard,
  NewsCard,
  PackageCard,
  WeatherCard,
  WikipediaCard
} from './tool-cards'

const SUGGESTIONS = [
  {
    icon: Globe,
    title: 'Actualité tech',
    prompt: 'Résume les actualités tech importantes du jour avec sources'
  },
  {
    icon: Calculator,
    title: 'Calcul',
    prompt: 'Calcule (1250 * 1.2 + 340) / 4 et détaille le résultat'
  },
  {
    icon: Users,
    title: 'Recherche profonde',
    prompt:
      'Fais une recherche approfondie sur les agents IA open source en 2026 : comparatif, forces, limites, avec sources'
  },
  {
    icon: Clock,
    title: 'Explique-moi',
    prompt: 'Explique simplement comment fonctionne un agent IA avec outils'
  },
  {
    icon: Globe,
    title: 'Météo',
    prompt: 'Quelle est la météo à Paris et Antananarivo cette semaine ?'
  },
  {
    icon: Search,
    title: 'GitHub',
    prompt: 'Donne-moi les stats du dépôt vercel/ai sur GitHub'
  },
  {
    icon: Globe,
    title: 'Pays',
    prompt: 'Fiche pays de Madagascar : capitale, population, langues, drapeau'
  },
  {
    icon: Search,
    title: 'Livre',
    prompt: 'Trouve le livre Dune de Frank Herbert avec sa couverture'
  }
]

type LoosePart = {
  type: string
  text?: string
  toolName?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function isToolPart(part: LoosePart): boolean {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

function toolQuery(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  const query = (input as { query?: unknown }).query
  if (typeof query === 'string' && query.trim() !== '') return query
  const task = (input as { task?: unknown }).task
  if (typeof task === 'string' && task.trim() !== '') {
    return task.length > 90 ? `${task.slice(0, 90)}…` : task
  }
  return null
}

function RichOutput({ part }: { part: LoosePart }) {
  if (part.state !== 'output-available') return null
  const output = part.output as { kind?: unknown } | null
  if (typeof output !== 'object' || output === null) return null
  switch (output.kind) {
    case 'weather':
      return <WeatherCard data={output as WeatherData} />
    case 'currency':
      return <CurrencyCard data={output as CurrencyData} />
    case 'crypto':
      return <CryptoCard data={output as CryptoData} />
    case 'dictionary':
      return <DictionaryCard data={output as DictionaryData} />
    case 'wikipedia':
      return <WikipediaCard data={output as WikipediaData} />
    case 'news':
      return <NewsCard data={output as NewsData} />
    case 'github':
      return <GithubCard data={output as GithubData} />
    case 'arxiv':
      return <ArxivCard data={output as ArxivData} />
    case 'package':
      return <PackageCard data={output as PackageData} />
    case 'book':
      return <BookCard data={output as BookData} />
    case 'country':
      return <CountryCard data={output as CountryData} />
    case 'media':
      return <MediaCard data={output as MediaData} />
    case 'entity':
      return <EntityCard data={output as EntityData} />
    default:
      return null
  }
}

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Recherche web',
  delegate_research: 'Sous-agent recherche',
  calculator: 'Calculatrice',
  datetime: 'Date et heure',
  weather: 'Météo',
  currency: 'Devises',
  crypto: 'Crypto',
  dictionary: 'Dictionnaire',
  wikipedia: 'Wikipédia',
  tech_news: 'Tech news',
  github: 'GitHub',
  arxiv: 'arXiv',
  npm: 'npm',
  pypi: 'PyPI',
  book: 'Livre',
  music: 'Musique',
  country: 'Pays',
  spacex: 'SpaceX',
  quake: 'Séismes',
  holidays: 'Fériés',
  pokemon: 'Pokémon',
  wikidata: 'Wikidata'
}

function ToolCard({ part }: { part: LoosePart }) {
  const name =
    part.type === 'dynamic-tool'
      ? (part.toolName ?? 'outil')
      : part.type.replace(/^tool-/, '')
  const label = TOOL_LABELS[name] ?? name
  const running =
    part.state === 'input-streaming' || part.state === 'input-available'
  const failed = part.state === 'output-error'
  const rich = RichOutput({ part })
  if (rich) return rich
  const fallback =
    part.state === 'output-available' && typeof part.output === 'string'
      ? part.output
      : null
  const query = toolQuery(part.input)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {name === 'web_search' ? (
        <Search size={13} className="shrink-0" />
      ) : (
        <Wrench size={13} className="shrink-0" />
      )}
      <span className="font-medium text-foreground">{label}</span>
      {fallback ? (
        <span className="min-w-0 flex-1 truncate">{fallback}</span>
      ) : query ? (
        <span className="min-w-0 flex-1 truncate">« {query} »</span>
      ) : (
        <span className="flex-1" />
      )}
      {failed ? (
        <span className="shrink-0 text-destructive">échec</span>
      ) : running ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          en cours…
        </span>
      ) : (
        <span className="shrink-0 text-emerald-600 dark:text-emerald-400">✓</span>
      )}
    </div>
  )
}

function AssistantParts({
  message,
  streaming
}: {
  message: UIMessage
  streaming: boolean
}) {
  const parts = (message.parts ?? []) as LoosePart[]
  const lastTextIndex = parts.reduce(
    (last, part, index) => (part.type === 'text' ? index : last),
    -1
  )
  return (
    <div className="flex w-full flex-col gap-2">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div
              key={index}
              className="whitespace-pre-wrap text-sm leading-6 text-foreground"
            >
              {part.text}
              {streaming && index === lastTextIndex ? (
                <span className="ml-1 inline-block size-2 animate-pulse rounded-sm bg-foreground/70" />
              ) : null}
            </div>
          )
        }
        if (isToolPart(part)) return <ToolCard key={index} part={part} />
        return null
      })}
    </div>
  )
}

export function AgentChat() {
  const [input, setInput] = useState('')
  const { messages, status, error, sendMessage, stop, setMessages, regenerate } =
    useChat({
      transport: new DefaultChatTransport({ api: '/api/agent/chat' })
    })

  const isBusy = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    setInput('')
    void sendMessage({ text: trimmed })
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-sm font-medium">{AGENT_NAME}</span>
        {!isEmpty && !isBusy ? (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 rounded-full border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus size={13} />
            Nouvelle conversation
          </button>
        ) : (
          <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {isBusy ? 'Travaille…' : 'En ligne'}
          </span>
        )}
      </header>

      {error ? (
        <div className="mx-4 mb-2 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">La requête a échoué</p>
            <p className="mt-0.5 text-muted-foreground">{error.message}</p>
          </div>
          <button
            type="button"
            onClick={() => regenerate()}
            className="shrink-0 rounded-full border border-input px-2.5 py-1 text-xs transition-colors hover:bg-accent"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-[10vh]">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
              {AGENT_NAME}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Météo, devises, crypto, dico, wiki, news, GitHub, arXiv —
              recherche web et sous-agent, 100 % serverless.
            </p>
          </div>
          <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s.title}
                type="button"
                onClick={() => submit(s.prompt)}
                className="flex items-center gap-2.5 rounded-2xl border border-input bg-card px-3.5 py-3 text-left text-sm transition-colors hover:bg-accent"
              >
                <s.icon
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span>
                  <span className="block font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.prompt}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="flex flex-col gap-6 py-6">
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {(message.parts ?? [])
                      .filter(p => p.type === 'text')
                      .map(p => (p as { text: string }).text)
                      .join('')}
                  </div>
                </div>
              ) : (
                <AssistantParts
                  key={message.id}
                  message={message}
                  streaming={
                    status === 'streaming' && index === messages.length - 1
                  }
                />
              )
            )}
            {status === 'submitted' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                L’agent réfléchit…
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className={cn('shrink-0 px-4 pb-6 sm:px-6', isEmpty && 'mx-auto w-full max-w-xl')}>
        <form
          onSubmit={e => {
            e.preventDefault()
            submit(input)
          }}
          className="w-full"
        >
          <div className="flex items-end gap-2 rounded-3xl border border-input bg-card p-2 pl-4">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit(input)
                }
              }}
              placeholder="Poser une question…"
              rows={1}
              className="field-sizing-content max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type={isBusy ? 'button' : 'submit'}
              disabled={!isBusy && !input.trim()}
              onClick={isBusy ? () => stop() : undefined}
              aria-label={isBusy ? 'Arrêter' : 'Envoyer'}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {isBusy ? <Square size={15} /> : <ArrowUp size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
