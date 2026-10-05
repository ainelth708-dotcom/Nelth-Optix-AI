// ---------------------------------------------------------------------------
// Agent task machine (nanoMuse-style lifecycle, serverless-compatible).
//
// Tasks are first-class objects: every unit of agent work moves through
// explicit states, records history, and can be paused/resumed/cancelled.
// This module is pure (no I/O): persistence lives in the caller (e.g.
// Postgres), so the same machine runs in serverless functions, where each
// invocation resumes from stored state instead of holding a process.
// ---------------------------------------------------------------------------

export type AgentTaskState =
  | 'IDLE'
  | 'PLANNING'
  | 'RUNNING'
  | 'BROWSING'
  | 'USING_TOOL'
  | 'WAITING_APPROVAL'
  | 'WAITING_USER'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED'
  | 'CANCELLED'

export type AgentStepState = 'pending' | 'active' | 'done' | 'error'

export interface AgentTaskStep {
  id: string
  label: string
  state: AgentStepState
}

export interface AgentTaskEvent {
  state: AgentTaskState
  at: number
  note?: string
}

export interface AgentTaskArtifact {
  id: string
  label: string
  kind: string
}

export interface AgentTask {
  id: string
  title: string
  goalId: string | null
  state: AgentTaskState
  /** 0–100. Maintained by the caller; set to 100 on COMPLETED. */
  progress: number
  steps: AgentTaskStep[]
  artifacts: AgentTaskArtifact[]
  history: AgentTaskEvent[]
  result: string | null
  createdAt: number
  updatedAt: number
}

const TERMINAL_STATES: AgentTaskState[] = ['COMPLETED', 'FAILED', 'CANCELLED']

/** Legal transitions — anything else throws in transitionTask. */
export const AGENT_TASK_TRANSITIONS: Record<AgentTaskState, AgentTaskState[]> =
  {
    IDLE: ['PLANNING', 'RUNNING', 'CANCELLED'],
    PLANNING: ['RUNNING', 'PAUSED', 'CANCELLED', 'FAILED'],
    RUNNING: [
      'BROWSING',
      'USING_TOOL',
      'VERIFYING',
      'WAITING_APPROVAL',
      'WAITING_USER',
      'PAUSED',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    ],
    BROWSING: [
      'RUNNING',
      'VERIFYING',
      'WAITING_APPROVAL',
      'PAUSED',
      'FAILED',
      'CANCELLED'
    ],
    USING_TOOL: [
      'RUNNING',
      'VERIFYING',
      'WAITING_APPROVAL',
      'PAUSED',
      'FAILED',
      'CANCELLED'
    ],
    VERIFYING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    WAITING_APPROVAL: ['RUNNING', 'CANCELLED', 'FAILED'],
    WAITING_USER: ['RUNNING', 'CANCELLED', 'FAILED'],
    PAUSED: ['RUNNING', 'CANCELLED'],
    COMPLETED: [],
    FAILED: [],
    CANCELLED: []
  }

export function isTerminalTaskState(state: AgentTaskState): boolean {
  return TERMINAL_STATES.includes(state)
}

export function canTransitionTask(
  from: AgentTaskState,
  to: AgentTaskState
): boolean {
  if (from === to) return true
  return (AGENT_TASK_TRANSITIONS[from] ?? []).includes(to)
}

function newTaskId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `task-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function createAgentTask(
  title: string,
  goalId?: string | null
): AgentTask {
  const now = Date.now()
  const trimmed = title.trim().slice(0, 120) || 'Tâche sans titre'
  return {
    id: newTaskId(),
    title: trimmed,
    goalId: goalId ?? null,
    state: 'IDLE',
    progress: 0,
    steps: [],
    artifacts: [],
    history: [{ state: 'IDLE', at: now }],
    result: null,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Immutable transition: validates legality, appends history, stamps
 * updatedAt. Throws on illegal transitions (fail loudly, never silently
 * corrupt task state).
 */
export function transitionTask(
  task: AgentTask,
  to: AgentTaskState,
  note?: string
): AgentTask {
  if (!canTransitionTask(task.state, to)) {
    throw new Error(
      `Illegal agent task transition: ${task.state} → ${to} (${task.id})`
    )
  }
  const now = Date.now()
  return {
    ...task,
    state: to,
    progress: to === 'COMPLETED' ? 100 : task.progress,
    updatedAt: now,
    history: [
      ...task.history,
      note ? { state: to, at: now, note } : { state: to, at: now }
    ]
  }
}
