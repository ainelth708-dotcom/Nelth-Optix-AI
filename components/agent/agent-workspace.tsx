'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  ArrowUp,
  ClipboardList,
  Image as ImageIcon,
  Plus,
  Search,
  Square,
  X,
  Zap
} from 'lucide-react'

import {
  type AgentTask,
  type AgentTaskState,
  canTransitionTask,
  createAgentTask,
  isTerminalTaskState,
  transitionTask
} from '@/lib/agent/task'
import type { UIMessage } from '@/lib/types/ai'
import { cn } from '@/lib/utils'
import { getTextFromParts } from '@/lib/utils/message-utils'

import { type CompanionState, NelthCompanion } from './nelth-companion'
import { PlanPanel } from './plan-panel'
import { TrackingPanel } from './tracking-panel'

const TASK_STATE_LABEL: Record<AgentTaskState, string> = {
  IDLE: 'En attente',
  PLANNING: 'Planification…',
  RUNNING: 'Travail en cours…',
  BROWSING: 'Navigation…',
  USING_TOOL: 'Utilise un outil…',
  WAITING_APPROVAL: 'En attente d’approbation',
  WAITING_USER: 'En attente de réponse',
  VERIFYING: 'Vérification…',
  COMPLETED: 'Terminé',
  FAILED: 'Échec',
  PAUSED: 'En pause',
  CANCELLED: 'Annulé'
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function messageUsesTool(message: UIMessage): boolean {
  return (message.parts ?? []).some(p => {
    const part = p as { toolCallId?: unknown; type?: unknown }
    return part.toolCallId != null || String(part.type ?? '').includes('tool')
  })
}

function safeTransition(task: AgentTask, to: AgentTaskState): AgentTask {
  if (task.state === to || !canTransitionTask(task.state, to)) return task
  try {
    return transitionTask(task, to)
  } catch {
    return task
  }
}

/**
 * Agent workspace (v1): a new Nelth-IA interface for goal-driven work.
 * Conversations run on the EXISTING chat API + models (no new provider);
 * the agent task machine (lib/agent/task.ts) tracks the real lifecycle:
 * created on send, PLANNING → RUNNING → (USING_TOOL) → COMPLETED/FAILED.
 */
export function AgentWorkspace() {
  const reactId = useId()
  const router = useRouter()
  const [chatId] = useState(
    () => `agent-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
  )
  const [task, setTask] = useState<AgentTask | null>(null)
  const [input, setInput] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  // Single flow, two modes (no separate sections): Discussion for fast
  // chat, Tâche for the autonomous plan→run loop. Suivis lives in an
  // overlay sheet, one tap away.
  const [mode, setMode] = useState<'chat' | 'task'>('chat')
  const [suivisOpen, setSuivisOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [lastActiveAt, setLastActiveAt] = useState(() => Date.now())

  const { messages, status, sendMessage, stop, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
        const lastMessage = messages[messages.length - 1]
        return {
          body: {
            trigger,
            chatId,
            messageId,
            messages,
            message: trigger === 'submit-message' ? lastMessage : undefined,
            isNewChat: trigger === 'submit-message' && messages.length === 1
          }
        }
      }
    })
  })

  const busy = status === 'submitted' || status === 'streaming'

  // Drive the task machine from the real request lifecycle.
  useEffect(() => {
    setTask(prev => {
      if (!prev || isTerminalTaskState(prev.state)) return prev
      if (status === 'error') return safeTransition(prev, 'FAILED')
      if (status === 'submitted') return safeTransition(prev, 'PLANNING')
      if (status === 'streaming') {
        const last = messages[messages.length - 1]
        const usingTool = last?.role === 'assistant' && messageUsesTool(last)
        return safeTransition(prev, usingTool ? 'USING_TOOL' : 'RUNNING')
      }
      if (status === 'ready') return safeTransition(prev, 'COMPLETED')
      return prev
    })
  }, [status, messages])

  // Elapsed clock while a task is active.
  useEffect(() => {
    if (!task || isTerminalTaskState(task.state)) return
    const t = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [task])

  // Idle clock for the sleeping companion (cheap 15s tick forces the
  // sleeping transition to re-evaluate).
  const [, setIdleTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setIdleTick(v => v + 1), 15000)
    return () => window.clearInterval(t)
  }, [])

  const markActive = () => setLastActiveAt(Date.now())

  const canSend = input.trim().length > 0 && !busy

  const handleSend = () => {
    const text = input.trim()
    if (!text || busy) return
    const next = transitionTask(
      createAgentTask(text),
      'PLANNING',
      'web session'
    )
    setTask(next)
    setInput('')
    markActive()
    void sendMessage({ text })
  }

  const handleNewSession = () => {
    try {
      stop()
    } catch {
      // No active stream — nothing to stop.
    }
    setMessages([])
    setTask(null)
    setInput('')
  }

  const assistantText = useMemo(
    () =>
      new Map<string, string>(
        messages
          .filter(m => m.role === 'assistant')
          .map(m => [m.id, getTextFromParts(m.parts)])
      ),
    [messages]
  )

  const taskActive = task !== null && !isTerminalTaskState(task.state)

  const appendAssistantMessage = (text: string) => {
    const id = `plan-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`
    setMessages(prev => [
      ...prev,
      { id, role: 'assistant', parts: [{ type: 'text', text }] } as UIMessage
    ])
    markActive()
    setMode('chat')
  }

  // Companion mirrors the REAL agent/task state — never random.
  const companionState: CompanionState = (() => {
    if (task && !isTerminalTaskState(task.state)) {
      switch (task.state) {
        case 'PLANNING':
        case 'VERIFYING':
          return 'thinking'
        case 'RUNNING':
          return 'working'
        case 'USING_TOOL':
          return 'tool'
        case 'BROWSING':
          return 'browsing'
        case 'WAITING_USER':
        case 'PAUSED':
          return 'waiting'
        case 'WAITING_APPROVAL':
          return 'approval'
        default:
          return 'working'
      }
    }
    if (task?.state === 'COMPLETED') return 'success'
    if (task?.state === 'FAILED') return 'error'
    if (
      messages.length === 0 &&
      !taskActive &&
      Date.now() - lastActiveAt > 120000
    ) {
      return 'sleeping'
    }
    if (inputFocused && input.trim().length > 0) return 'listening'
    return 'idle'
  })()

  return (
    <div className="agent-ambient relative mx-auto flex h-full min-h-0 w-full max-w-[752px] flex-1 flex-col px-4 pb-4 pt-14 md:pt-8">
      {/* Workspace header: companion + identity + live task state */}
      <div className="sticky top-0 z-10 -mx-4 bg-transparent px-4 pb-2 pt-1 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <NelthCompanion state={companionState} size={32} />
          <span className="text-[15px] font-semibold">Agent</span>{' '}
          {task && (
            <>
              <span
                className={cn(
                  'ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  task.state === 'FAILED'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : task.state === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-black/[0.06] text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
                )}
              >
                {TASK_STATE_LABEL[task.state]}
              </span>
              {taskActive && (
                <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {formatElapsed(clock - task.createdAt)}
                </span>
              )}
              {taskActive && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      stop()
                    } finally {
                      setTask(prev =>
                        prev ? safeTransition(prev, 'PAUSED') : prev
                      )
                    }
                  }}
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  <Square size={11} />
                  Stop
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setSuivisOpen(true)}
            aria-label="Suivis"
            title="Objectifs, mémoire, fil"
            className="ml-auto flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/5 hover:text-foreground dark:text-neutral-400 dark:hover:bg-white/10"
          >
            <ClipboardList size={16} />
          </button>
        </div>
      </div>

      {mode === 'task' ? (
        <PlanPanel
          task={task}
          onTask={setTask}
          onAppendMessage={appendAssistantMessage}
        />
      ) : messages.length === 0 ? (
        /* Home: companion + prompt + capability chips */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8 text-center">
          <NelthCompanion state={companionState} size={132} />
          <h1 className="mt-5 text-[22px] font-bold leading-tight">
            How can I help?
          </h1>
          <p className="mt-1 max-w-[380px] text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Confie un objectif à l’agent : il planifie, agit avec tes outils et
            vérifie le résultat.
          </p>
          <div className="mt-6 grid w-full max-w-[520px] grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setInput('Fais une recherche approfondie : ')}
              className="agent-fade-in group rounded-2xl border border-black/10 bg-white/70 p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] dark:border-white/10 dark:bg-white/[0.06]"
            >
              <Search size={16} className="text-sky-600 dark:text-sky-300" />
              <p className="mt-2 text-[13px] font-semibold leading-snug">
                Rechercher
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                Web en profondeur, sources citées
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('task')
              }}
              className="agent-fade-in group rounded-2xl border border-black/10 bg-white/70 p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] dark:border-white/10 dark:bg-white/[0.06]"
            >
              <Zap size={16} className="text-violet-600 dark:text-violet-300" />
              <p className="mt-2 text-[13px] font-semibold leading-snug">
                Exécuter une tâche
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                Plan, outils, vérification
              </p>
            </button>
            <button
              type="button"
              onClick={() => router.push('/imagine')}
              className="agent-fade-in group rounded-2xl border border-black/10 bg-white/70 p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] dark:border-white/10 dark:bg-white/[0.06]"
            >
              <ImageIcon
                size={16}
                className="text-emerald-600 dark:text-emerald-300"
              />
              <p className="mt-2 text-[13px] font-semibold leading-snug">
                Générer une image
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                Studio Imagine, 55 presets
              </p>
            </button>
          </div>
          <button
            type="button"
            onClick={handleNewSession}
            className="mt-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-black/5 hover:text-foreground dark:text-neutral-400 dark:hover:bg-white/10"
          >
            <Plus size={13} />
            Nouvelle session
          </button>
        </div>
      ) : (
        /* Active session: messages + live activity */
        <>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="flex flex-col gap-4">
              {messages.map(m => {
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="agent-fade-in flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-black px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] dark:bg-white dark:text-black">
                        {getTextFromParts(m.parts)}
                      </p>
                    </div>
                  )
                }
                const text = assistantText.get(m.id) ?? ''
                if (!text.trim()) return null
                return (
                  <div key={m.id} className="agent-fade-in flex justify-start">
                    <p className="max-w-[95%] whitespace-pre-wrap text-[14.5px] leading-relaxed">
                      {text}
                    </p>
                  </div>
                )
              })}
              {taskActive && (
                <div className="flex cursor-default select-none flex-row items-center gap-2 text-[13px] text-neutral-500 dark:text-neutral-400">
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-40" />
                    <span className="relative inline-flex size-2 rounded-full bg-neutral-400" />
                  </span>
                  <span>
                    Nelth-IA — {TASK_STATE_LABEL[task?.state ?? 'IDLE']}
                  </span>
                </div>
              )}
              {status === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  La tâche a échoué — reformule ou réessaie.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mode pills + composer (chat mode only; task mode has its own flow) */}
      <div className="flex justify-center gap-1 pb-2">
        {(
          [
            ['chat', 'Discussion'],
            ['task', 'Tâche']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              mode === id
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'chat' && (
        <div className="w-full overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.10)] transition-shadow focus-within:border-black/20 focus-within:shadow-[0_20px_60px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-card dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Décris ton objectif…"
            rows={2}
            className="max-h-[160px] min-h-[52px] w-full resize-none bg-transparent px-[19px] pt-[14px] text-[15px] leading-[22px] outline-none placeholder:text-[#707070] dark:text-foreground"
          />
          <div className="flex items-center justify-end px-[15px] pb-[11px]">
            <button
              type="button"
              onClick={handleSend}
              aria-label="Envoyer"
              title="Envoyer"
              disabled={!canSend}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Suivis sheet (goals / memory / feed, one tap away) */}
      {suivisOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Suivis"
              onClick={() => setSuivisOpen(false)}
              className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/55 backdrop-blur-md"
            >
              <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                <div
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-[560px] rounded-t-[24px] bg-white p-4 pb-6 text-neutral-800 shadow-[0_24px_90px_rgba(0,0,0,0.5)] sm:rounded-[24px] dark:bg-[#202020] dark:text-neutral-200"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[15px] font-semibold">Suivis</p>
                    <button
                      type="button"
                      onClick={() => setSuivisOpen(false)}
                      aria-label="Fermer"
                      className="rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="max-h-[70dvh] overflow-y-auto">
                    <TrackingPanel />
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
