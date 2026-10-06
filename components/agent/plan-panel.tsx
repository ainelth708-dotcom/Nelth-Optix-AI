'use client'

import { useEffect, useRef, useState } from 'react'

import { Check, Loader2, Play, ShieldAlert, X } from 'lucide-react'

import type {
  AgentPlanStep,
  AgentRunEvent,
  AgentTranscriptEntry
} from '@/lib/agent/orchestrator'
import {
  type AgentTask,
  type AgentTaskState,
  canTransitionTask,
  createAgentTask,
  isTerminalTaskState,
  transitionTask
} from '@/lib/agent/task'
import type { AgentCapabilities } from '@/lib/agent/worker/types'
import { cn } from '@/lib/utils'

interface PendingApproval {
  call: { tool: string; args: Record<string, unknown> }
  goal: string
  steps: AgentPlanStep[]
  transcript: AgentTranscriptEntry[]
  startIndex: number
}

interface StepView {
  title: string
  detail: string
  state: 'pending' | 'active' | 'done' | 'error'
  live: string
}

function safeTransition(task: AgentTask, to: AgentTaskState): AgentTask {
  if (task.state === to || !canTransitionTask(task.state, to)) return task
  try {
    return transitionTask(task, to)
  } catch {
    return task
  }
}

async function consumeSse(
  res: Response,
  onEvent: (event: AgentRunEvent) => void
): Promise<void> {
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(err?.error ?? `Requête refusée (${res.status}).`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        const text = line.startsWith('data:') ? line.slice(5).trim() : ''
        if (!text) continue
        try {
          onEvent(JSON.parse(text) as AgentRunEvent)
        } catch {
          // Malformed frame — skip.
        }
      }
    }
  }
}

/**
 * Plan & run panel: goal → structured plan (model) → checklist →
 * bounded multi-step execution with LIVE step events (SSE), approval
 * gate for sensitive tools, verdict appended to the chat on completion.
 * Everything shown reflects real backend events — nothing is faked.
 */
export function PlanPanel({
  task,
  onTask,
  onAppendMessage
}: {
  task: AgentTask | null
  onTask: (task: AgentTask | null) => void
  onAppendMessage: (text: string) => void
}) {
  const [goalInput, setGoalInput] = useState('')
  const [planTitle, setPlanTitle] = useState('')
  const [steps, setSteps] = useState<StepView[]>([])
  const [planning, setPlanning] = useState(false)
  const [running, setRunning] = useState(false)
  const [activity, setActivity] = useState('')
  const [approval, setApproval] = useState<PendingApproval | null>(null)
  const [clarify, setClarify] = useState<{
    question: string
    options: string[]
    pausedIndex: number
    goal: string
  } | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [caps, setCaps] = useState<AgentCapabilities | null>(null)
  const transcriptRef = useRef<AgentTranscriptEntry[]>([])
  const abortedRef = useRef(false)

  // Real capabilities (single source of truth) — never hardcoded.
  useEffect(() => {
    fetch('/api/agent/capabilities')
      .then(r => r.json())
      .then(j => {
        if (j?.capabilities) setCaps(j.capabilities as AgentCapabilities)
      })
      .catch(() => {})
  }, [])

  const busy = planning || running

  const handlePlan = async (goalOverride?: string) => {
    const goal = (goalOverride ?? goalInput).trim()
    if (!goal || busy) return
    setPlanning(true)
    setError(null)
    setSteps([])
    setPlanTitle('')
    setClarify(null)
    try {
      const res = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal })
      })
      const json = (await res.json().catch(() => null)) as {
        plan?: {
          title?: string
          steps?: Array<{ title?: string; detail?: string }>
        }
        clarify?: boolean
        question?: string
        error?: string
      } | null
      if (!res.ok) {
        throw new Error(json?.error ?? 'Planification impossible.')
      }
      // Vague goal: the backend asks first instead of planning garbage.
      if (json?.clarify && json.question) {
        setClarify({
          question: json.question,
          options: [],
          pausedIndex: 0,
          goal
        })
        setActivity('Question pour toi…')
        return
      }
      if (!json?.plan) {
        throw new Error(json?.error ?? 'Planification impossible.')
      }
      setPlanTitle(json.plan.title ?? goal.slice(0, 80))
      setSteps(
        (json.plan.steps ?? []).map(s => ({
          title: String(s.title ?? 'Étape'),
          detail: String(s.detail ?? ''),
          state: 'pending' as const,
          live: ''
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planification impossible.')
    } finally {
      setPlanning(false)
    }
  }

  const markStep = (index: number, patch: Partial<StepView>) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const handleRunEvents = (runTask: AgentTask, event: AgentRunEvent) => {
    switch (event.type) {
      case 'step-start':
        markStep(event.index, { state: 'active', live: '' })
        onTask(safeTransition(runTask, 'RUNNING'))
        setActivity(event.title)
        break
      case 'step-text':
        markStep(event.index, { live: event.text })
        break
      case 'decide':
        setActivity(
          event.decision === 'RETRY'
            ? 'Nouvelle tentative…'
            : event.decision === 'REPLAN'
              ? 'Révision du plan…'
              : event.decision === 'FINISH'
                ? 'Clôture…'
                : `Décision : ${event.reason || 'continuer'}`
        )
        break
      case 'retry':
        markStep(event.index, { state: 'active', live: '' })
        onTask(safeTransition(runTask, 'RUNNING'))
        setActivity(`Nouvelle tentative (essai ${event.attempt})…`)
        break
      case 'replan':
        setSteps(
          event.steps.map(s => ({
            title: s.title,
            detail: s.detail,
            state: 'pending' as const,
            live: ''
          }))
        )
        setActivity('Plan révisé, reprise…')
        break
      case 'verify':
        setActivity('Vérification des preuves…')
        break
      case 'clarify':
        markStep(event.index, { state: 'active' })
        onTask(safeTransition(runTask, 'WAITING_USER'))
        setClarify({
          question: event.question,
          options: event.options ?? [],
          pausedIndex: event.index,
          goal: lastGoalRef.current
        })
        setAnswer('')
        setActivity('Question pour toi…')
        break
      case 'tool-call':
        markStep(event.index, { state: 'active' })
        onTask(safeTransition(runTask, 'USING_TOOL'))
        setActivity(
          event.auto
            ? `Utilise ${event.tool}…`
            : `Demande d’approbation : ${event.tool}…`
        )
        break
      case 'step-done':
        markStep(event.index, { state: 'done', live: '' })
        transcriptRef.current.push({
          role: 'assistant',
          text: event.text
        })
        break
      case 'approval-needed': {
        markStep(event.index, { state: 'active' })
        onTask(safeTransition(runTask, 'WAITING_APPROVAL'))
        setApproval({
          call: event.call,
          goal: lastGoalRef.current,
          steps: lastStepsRef.current,
          transcript: [...transcriptRef.current],
          startIndex: event.index
        })
        setActivity(`Approbation requise : ${event.call.tool}`)
        break
      }
      case 'done':
        onTask(
          safeTransition(runTask, event.completed ? 'COMPLETED' : 'FAILED')
        )
        onAppendMessage(
          event.completed
            ? `✅ Tâche terminée — ${planTitle || 'objectif'}\n\n${event.verdict}`
            : `⚠️ Tâche inachevée — ${planTitle || 'objectif'}\n\n${event.verdict}`
        )
        setActivity('')
        break
      case 'error':
        onTask(safeTransition(runTask, 'FAILED'))
        setError(event.message)
        setActivity('')
        break
    }
  }

  const lastGoalRef = useRef('')
  const lastStepsRef = useRef<AgentPlanStep[]>([])

  const runStream = async (
    goal: string,
    planSteps: AgentPlanStep[],
    resume?: { transcript: AgentTranscriptEntry[]; startIndex: number },
    existingTask?: AgentTask | null
  ) => {
    const runTask =
      existingTask && !isTerminalTaskState(existingTask.state)
        ? existingTask
        : transitionTask(createAgentTask(goal), 'RUNNING')
    onTask(runTask)
    lastGoalRef.current = goal
    lastStepsRef.current = planSteps
    if (!resume) transcriptRef.current = []
    setRunning(true)
    setError(null)
    setApproval(null)
    setClarify(null)
    abortedRef.current = false
    // Snapshot for server-side persistence (recoverable across HTTP).
    const snapshot = {
      id: runTask.id,
      title: runTask.title,
      goalId: null,
      state: 'RUNNING' as const,
      progress: 0,
      steps: [],
      artifacts: [],
      history: runTask.history,
      result: null,
      createdAt: runTask.createdAt,
      updatedAt: runTask.updatedAt
    }
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          steps: planSteps,
          taskId: runTask.id,
          task: snapshot,
          ...(resume
            ? { transcript: resume.transcript, startIndex: resume.startIndex }
            : {})
        })
      })
      await consumeSse(res, event => handleRunEvents(runTask, event))
    } catch (err) {
      onTask(safeTransition(runTask, 'FAILED'))
      setError(err instanceof Error ? err.message : 'Exécution impossible.')
    } finally {
      setRunning(false)
    }
  }

  const handleExecute = () => {
    const goal = (planTitle || goalInput).trim()
    const planSteps = steps.map(s => ({ title: s.title, detail: s.detail }))
    if (!goal || planSteps.length === 0 || busy || approval) return
    setSteps(prev =>
      prev.map(s => ({ ...s, state: 'pending' as const, live: '' }))
    )
    void runStream(goal, planSteps)
  }

  const handleDecide = (decision: 'ALLOW_ONCE' | 'DENY') => {
    const pending = approval
    if (!pending || running) return
    setApproval(null)
    const runTask =
      task && !isTerminalTaskState(task.state)
        ? task
        : transitionTask(createAgentTask(pending.goal), 'RUNNING')
    onTask(runTask)
    void (async () => {
      setRunning(true)
      try {
        const res = await fetch('/api/agent/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call: pending.call,
            decision,
            taskId: runTask.id,
            resume: {
              goal: pending.goal,
              steps: pending.steps,
              transcript: pending.transcript,
              startIndex: pending.startIndex
            }
          })
        })
        await consumeSse(res, event => handleRunEvents(runTask, event))
      } catch (err) {
        onTask(safeTransition(runTask, 'FAILED'))
        setError(err instanceof Error ? err.message : 'Décision impossible.')
      } finally {
        setRunning(false)
      }
    })()
  }

  const handleAnswerClarify = () => {
    const pending = clarify
    const text = answer.trim()
    if (!pending || !text || running) return
    // Plan-time clarification (no steps yet): enrich the goal and replan
    // automatically instead of executing blindly.
    if (steps.length === 0) {
      const enriched = `${pending.goal} — ${text}`.slice(0, 2000)
      setClarify(null)
      setAnswer('')
      setGoalInput(enriched)
      void handlePlan(enriched)
      return
    }
    transcriptRef.current.push({ role: 'user', text: text.slice(0, 2000) })
    setClarify(null)
    setAnswer('')
    const runTask =
      task && !isTerminalTaskState(task.state)
        ? task
        : transitionTask(createAgentTask(lastGoalRef.current), 'RUNNING')
    onTask(safeTransition(runTask, 'RUNNING'))
    markStep(pending.pausedIndex, { state: 'active', live: '' })
    void runStream(
      lastGoalRef.current,
      lastStepsRef.current,
      {
        transcript: transcriptRef.current,
        startIndex: pending.pausedIndex
      },
      runTask
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4">
      {/* Real capabilities — AVAILABLE vs UNAVAILABLE, never faked. */}
      {caps && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          {(
            [
              ['browser', 'Navigateur'],
              ['computer', 'Ordinateur'],
              ['shell', 'Shell'],
              ['backgroundTasks', 'Tâches fond'],
              ['scheduling', 'Planification']
            ] as const
          ).map(([key, label]) => {
            const on = caps[key] === true
            return (
              <span
                key={key}
                title={on ? 'Disponible' : 'Non configuré'}
                className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    on ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  )}
                />
                {label}
              </span>
            )
          })}
        </div>
      )}
      {/* Goal input */}
      <div className="w-full overflow-hidden rounded-[18px] border border-[#e3e3e3] bg-white dark:border-border dark:bg-card">
        <textarea
          value={goalInput}
          onChange={e => setGoalInput(e.target.value)}
          placeholder="Objectif de la tâche… (ex : compare les prix des vols Paris–Tokyo en septembre)"
          rows={2}
          disabled={busy}
          className="max-h-[140px] min-h-[52px] w-full resize-none bg-transparent px-[16px] pt-[12px] text-[14px] leading-[21px] outline-none placeholder:text-[#707070] dark:text-foreground"
        />
        <div className="flex items-center justify-end gap-2 px-[12px] pb-[10px]">
          <button
            type="button"
            onClick={() => handlePlan()}
            disabled={!goalInput.trim() || busy}
            className="rounded-full border border-black/10 px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10"
          >
            {planning ? 'Planification…' : 'Planifier'}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={steps.length === 0 || busy || approval !== null}
            className="flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            <Play size={13} />
            Exécuter
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Steps checklist (real plan from the model) */}
      {steps.length > 0 && (
        <div className="w-full rounded-[18px] border border-[#e3e3e3] bg-white p-4 dark:border-border dark:bg-card">
          {planTitle && (
            <p className="mb-2 truncate text-[14px] font-semibold">
              {planTitle}
            </p>
          )}
          <ul className="agent-timeline-rail relative flex flex-col gap-3 text-neutral-700 dark:text-neutral-300">
            {steps.map((s, i) => (
              <li key={`${i}-${s.title}`} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    s.state === 'done'
                      ? 'bg-emerald-500 text-white'
                      : s.state === 'active'
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : s.state === 'error'
                          ? 'bg-red-500 text-white'
                          : 'bg-black/10 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'
                  )}
                >
                  {s.state === 'done' ? (
                    <Check size={12} strokeWidth={3} />
                  ) : s.state === 'active' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium leading-snug">
                    {s.title}
                  </p>
                  {s.detail && (
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {s.detail}
                    </p>
                  )}
                  {s.state === 'active' && s.live && (
                    <p className="mt-0.5 line-clamp-2 text-xs italic text-neutral-500 dark:text-neutral-400">
                      {s.live}…
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live activity */}
      {(running || activity) && (
        <div className="flex cursor-default select-none flex-row items-center gap-2 text-[13px] text-neutral-500 dark:text-neutral-400">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-neutral-400" />
          </span>
          <span className="truncate">{activity || 'Exécution…'}</span>
        </div>
      )}

      {/* Approval gate (RiskGate-style): sensitive tool waits here. */}
      {approval && (
        <div className="w-full rounded-[18px] border border-amber-500/40 bg-amber-500/[0.07] p-4 dark:bg-amber-400/10">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert size={16} />
            Approbation requise
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
            L’agent veut lire une page externe (
            <span className="font-mono text-[12px]">
              {typeof approval.call.args.url === 'string'
                ? approval.call.args.url.slice(0, 80)
                : approval.call.tool}
            </span>
            ). Autoriser une fois ?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleDecide('ALLOW_ONCE')}
              disabled={running}
              className="flex-1 rounded-full bg-black py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Autoriser une fois
            </button>
            <button
              type="button"
              onClick={() => handleDecide('DENY')}
              disabled={running}
              className="flex flex-1 items-center justify-center gap-1 rounded-full border border-black/10 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10"
            >
              <X size={14} />
              Refuser
            </button>
          </div>
        </div>
      )}

      {/* Clarification request: the agent genuinely needs an answer. */}
      {clarify && (
        <div className="w-full rounded-[18px] border border-sky-500/40 bg-sky-500/[0.07] p-4 dark:bg-sky-400/10">
          <p className="text-[14px] font-semibold text-sky-700 dark:text-sky-300">
            L’agent a besoin de toi
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-200">
            {clarify.question}
          </p>
          {clarify.options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {clarify.options.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswer(opt)}
                  className="rounded-full border border-sky-500/40 px-2.5 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/10 dark:text-sky-300"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAnswerClarify()
              }}
              placeholder="Ta réponse…"
              className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400 dark:border-white/15 dark:bg-black/20"
            />
            <button
              type="button"
              onClick={handleAnswerClarify}
              disabled={!answer.trim() || running}
              className="shrink-0 rounded-full bg-black px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
