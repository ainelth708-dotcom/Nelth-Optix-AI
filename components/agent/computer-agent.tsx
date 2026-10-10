'use client'

import React, { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import {
  Globe,
  Terminal,
  FolderTree,
  Shield,
  ArrowUp,
  Square,
  Plus,
  Sparkles,
  Camera,
  Play,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Laptop,
  Maximize2,
  Minimize2,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AGENT_NAME } from '@/agent/rules'
import { ComputerPanel } from './computer-panel'

const COMPUTER_SUGGESTIONS = [
  {
    icon: Globe,
    title: 'Navigation Web',
    prompt: 'Navigue sur wikipedia.org, prends un instantané et donne-moi les articles en vedette'
  },
  {
    icon: Terminal,
    title: 'Script Sandbox',
    prompt: 'Dans le workspace, crée un fichier sum.js qui additionne les nombres de 1 à 100 et exécute-le avec node'
  },
  {
    icon: Camera,
    title: 'Capture visuelle',
    prompt: 'Ouvre news.ycombinator.com, capture l’écran et résume les 3 titres principaux'
  },
  {
    icon: FolderTree,
    title: 'Exploration Workspace',
    prompt: 'Liste tous les fichiers du workspace et vérifie la version de node disponible'
  }
]

type LoosePart = {
  type: string
  text?: string
  toolName?: string
  state?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  errorText?: string
}

function isToolPart(part: LoosePart): boolean {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

function ComputerToolCard({ part }: { part: LoosePart }) {
  const name =
    part.type === 'dynamic-tool'
      ? (part.toolName ?? 'outil')
      : part.type.replace(/^tool-/, '')

  const running =
    part.state === 'input-streaming' || part.state === 'input-available'
  const failed = part.state === 'output-error'
  const input = part.input || {}
  const output = part.output || {}

  let icon = <Laptop size={14} className="text-sky-500 shrink-0" />
  let label = name
  let detail: string | null = null

  if (name.includes('navigate')) {
    icon = <Globe size={14} className="text-sky-500 shrink-0" />
    label = 'Navigation'
    detail = typeof input.url === 'string' ? input.url : null
  } else if (name.includes('snapshot')) {
    icon = <Sparkles size={14} className="text-indigo-500 shrink-0" />
    label = 'Instantané DOM'
    if (typeof output.interactiveElementsCount === 'number') {
      detail = `${output.interactiveElementsCount} éléments détectés`
    }
  } else if (name.includes('screenshot')) {
    icon = <Camera size={14} className="text-pink-500 shrink-0" />
    label = 'Capture d’écran'
  } else if (name.includes('click')) {
    icon = <Laptop size={14} className="text-sky-500 shrink-0" />
    label = 'Clic souris'
    detail = typeof input.ref === 'string' ? `sur ${input.ref}` : null
  } else if (name.includes('type')) {
    icon = <Laptop size={14} className="text-sky-500 shrink-0" />
    label = 'Saisie clavier'
    detail = typeof input.ref === 'string' ? `dans ${input.ref}` : null
  } else if (name.includes('files_list')) {
    icon = <FolderTree size={14} className="text-amber-500 shrink-0" />
    label = 'Liste fichiers'
    detail = typeof input.path === 'string' ? (input.path || '.') : '.'
  } else if (name.includes('files_read') || name.includes('files_write')) {
    icon = <FileCode size={14} className="text-amber-500 shrink-0" />
    label = name.includes('write') ? 'Écriture fichier' : 'Lecture fichier'
    detail = typeof input.path === 'string' ? input.path : null
  } else if (name.includes('exec')) {
    icon = <Terminal size={14} className="text-indigo-500 shrink-0" />
    label = 'Commande Shell'
    detail = typeof input.command === 'string' ? `$ ${input.command}` : null
  }

  // Approval required inline banner
  if (output.approvalRequired) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Action nécessitant votre accord</p>
          <p className="text-[11px] mt-0.5 text-rose-600/90 dark:text-rose-300/90">
            {String(output.message || 'Vérifiez et approuvez cette action dans le panneau Ordinateur.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground shadow-sm">
      {icon}
      <span className="font-semibold text-foreground">{label}</span>
      {detail && <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">« {detail} »</span>}
      {!detail && <span className="flex-1" />}

      {failed ? (
        <span className="shrink-0 text-rose-500 font-medium">échec</span>
      ) : running ? (
        <span className="flex shrink-0 items-center gap-1.5 text-sky-600 dark:text-sky-400 font-medium">
          <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />
          en cours…
        </span>
      ) : (
        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
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
    <div className="flex w-full flex-col gap-2.5">
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
        if (isToolPart(part)) return <ComputerToolCard key={index} part={part} />
        return null
      })}
    </div>
  )
}

export function ComputerAgent() {
  const [input, setInput] = useState('')
  const [mobileTab, setMobileTab] = useState<'chat' | 'panel'>('chat')
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)

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
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Mobile Tab Switcher (Visible on < lg screens) */}
      <div className="lg:hidden fixed top-2 right-4 z-40 flex items-center bg-card/90 backdrop-blur border border-border p-1 rounded-xl shadow-md text-xs">
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-colors',
            mobileTab === 'chat'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground'
          )}
        >
          <MessageSquare size={13} />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('panel')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-colors relative',
            mobileTab === 'panel'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground'
          )}
        >
          <Laptop size={13} />
          Machine
          {pendingApprovalsCount > 0 && (
            <span className="size-2 rounded-full bg-rose-500 animate-ping absolute -top-0.5 -right-0.5" />
          )}
        </button>
      </div>

      {/* Main Dual-Pane Container */}
      <div className="flex flex-1 w-full h-full p-2 md:p-3 gap-3 overflow-hidden">
        {/* LEFT PANE: Chat */}
        <div
          className={cn(
            'flex flex-col h-full bg-card/60 backdrop-blur-sm border border-border rounded-2xl overflow-hidden transition-all duration-300',
            panelExpanded ? 'hidden' : 'flex flex-1',
            mobileTab === 'panel' && 'hidden lg:flex'
          )}
        >
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border bg-card/40">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 text-white shadow-sm">
                <Laptop size={16} />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-tight">{AGENT_NAME}</span>
                <p className="text-[11px] text-muted-foreground">Pilote autonome • Web & Terminal</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEmpty && !isBusy ? (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="flex items-center gap-1.5 rounded-full border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus size={13} />
                  Nouvelle tâche
                </button>
              ) : (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {isBusy ? 'En exécution…' : 'En ligne'}
                </span>
              )}
            </div>
          </header>

          {/* Conversation Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {isEmpty ? (
              <div className="flex h-full flex-col items-center justify-center text-center max-w-md mx-auto p-4">
                <div className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20 mb-4">
                  <Laptop size={26} />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Que voulez-vous accomplir sur la machine ?
                </h2>
                <p className="text-xs text-muted-foreground mt-1 mb-6 leading-relaxed">
                  L’agent dispose d’un navigateur Chromium réel pour naviguer, cliquer et inspecter, ainsi que d’un terminal Bash pour tester et créer des fichiers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  {COMPUTER_SUGGESTIONS.map((item, idx) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => submit(item.prompt)}
                        className="group flex flex-col p-3 rounded-xl border border-border bg-card/60 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-left shadow-sm"
                      >
                        <div className="flex items-center gap-2 text-foreground font-semibold text-xs mb-1">
                          <Icon size={14} className="text-sky-500 group-hover:scale-110 transition-transform" />
                          <span>{item.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.prompt}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              messages.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col gap-1.5',
                    m.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted/50 border border-border/60 text-foreground rounded-bl-sm w-full'
                    )}
                  >
                    {m.role === 'user' ? (
                      <div className="whitespace-pre-wrap">
                        {(m.parts ?? [])
                          .filter(p => p.type === 'text')
                          .map(p => (p as { text: string }).text)
                          .join('')}
                      </div>
                    ) : (
                      <AssistantParts
                        message={m}
                        streaming={isBusy && messages[messages.length - 1]?.id === m.id}
                      />
                    )}
                  </div>
                </div>
              ))
            )}

            {error && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
                <span>Une erreur est survenue lors du traitement.</span>
                <button
                  type="button"
                  onClick={() => regenerate()}
                  className="font-medium underline hover:no-underline"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-border bg-card/40">
            <form
              onSubmit={e => {
                e.preventDefault()
                submit(input)
              }}
              className="flex items-center gap-2 bg-muted/60 border border-input rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-sky-500/30 transition-all"
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit(input)
                  }
                }}
                rows={1}
                placeholder="Donnez une mission à l'agent (ex: Va sur github, vérifie les releases)..."
                className="flex-1 bg-transparent resize-none outline-none text-xs leading-5 text-foreground placeholder:text-muted-foreground/60 max-h-28"
              />
              {isBusy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="p-2 rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                  title="Arrêter"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                  title="Envoyer"
                >
                  <ArrowUp size={14} />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT PANE: Computer Activity Panel */}
        <div
          className={cn(
            'h-full transition-all duration-300',
            panelExpanded ? 'flex-1' : 'w-full lg:w-[480px] xl:w-[540px]',
            mobileTab === 'chat' && 'hidden lg:block'
          )}
        >
          <div className="relative h-full flex flex-col">
            <ComputerPanel
              className="h-full"
              onApprovalCountChange={setPendingApprovalsCount}
            />
            {/* Desktop Full-Screen Toggle for Panel */}
            <button
              type="button"
              onClick={() => setPanelExpanded(prev => !prev)}
              className="hidden lg:flex absolute top-3.5 right-24 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              title={panelExpanded ? 'Réduire' : 'Plein écran'}
            >
              {panelExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
