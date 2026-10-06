// ---------------------------------------------------------------------------
// Autonomous agent core (Muse-like behavior, serverless-compatible).
//
// PLAN → EXECUTE → OBSERVE → DECIDE → CONTINUE / RETRY / REPLAN /
// CLARIFY / FINISH → VERIFY → VERIFIED RESULT.
//
// Design rules:
// - No fixed step count: the loop ends on verified completion (or honest
//   budgets: MAX_ROUNDS + MAX_ATTEMPTS_PER_STEP, documented as safety,
//   not as plan length).
// - All decisions live in the PURE reducer decideNextAction (fully
//   unit-tested). The model is consulted only for content needing
//   judgment: replan content, clarification questions, verification.
// - State is plain JSON (AgentRunState) persisted per step, so any HTTP
//   worker can resume via resumeTask — never blindly repeating a
//   possibly-completed action.
// - todoWrite is NOT duplicated: runStateToTodos derives the visible
//   todos from the real execution state.
// ---------------------------------------------------------------------------

export const MAX_ROUNDS = 12
export const MAX_ATTEMPTS_PER_STEP = 3

export interface AgentPlanStep {
  title: string
  detail: string
}

export interface AgentTranscriptEntry {
  role: 'user' | 'assistant' | 'observation'
  text: string
}

export type LoopDecision =
  | 'CONTINUE'
  | 'RETRY'
  | 'REPLAN'
  | 'CLARIFY'
  | 'FINISH'

export type RunStatus =
  | 'running'
  | 'waiting-approval'
  | 'waiting-user'
  | 'done'
  | 'failed'

export interface AgentRunState {
  taskId: string
  goal: string
  plan: AgentPlanStep[]
  currentStep: number
  doneSteps: number[]
  /** step index → attempts used (retry budget). */
  retries: Record<number, number>
  /** step index → last error (only for steps that exhausted retries). */
  failedSteps: Record<number, string>
  /** Evidence collected by tools, in order. */
  evidence: Array<{ step: number; tool: string; summary: string }>
  decisionLog: Array<{ at: number; decision: LoopDecision; reason: string }>
  verification: { passed: boolean; notes: string } | null
  result: string | null
  status: RunStatus
  transcript: AgentTranscriptEntry[]
  rounds: number
  updatedAt: number
}

export interface StepOutcome {
  ok: boolean
  text: string
  tools: string[]
  error?: string
}

export function createRunState(
  taskId: string,
  goal: string,
  plan: AgentPlanStep[]
): AgentRunState {
  const now = Date.now()
  return {
    taskId,
    goal,
    plan: plan.slice(0, 8),
    currentStep: 0,
    doneSteps: [],
    retries: {},
    failedSteps: {},
    evidence: [],
    decisionLog: [],
    verification: null,
    result: null,
    status: 'running',
    transcript: [],
    rounds: 0,
    updatedAt: now
  }
}

function logDecision(
  state: AgentRunState,
  decision: LoopDecision,
  reason: string
): void {
  state.decisionLog.push({ at: Date.now(), decision, reason })
}

/**
 * PURE next-action reducer (rule-based fast path — no model call).
 * Model judgment enters only through replan content, clarification
 * questions and verification verdicts (handled by the caller).
 */
export function decideNextAction(
  state: AgentRunState,
  outcome: StepOutcome | null
):
  | { action: 'CONTINUE'; step: number }
  | { action: 'RETRY'; step: number; attempt: number }
  | { action: 'FINISH'; reason: string } {
  const total = state.plan.length
  if (total === 0) return { action: 'FINISH', reason: 'empty-plan' }

  // Fresh start (or resume with no new outcome yet).
  if (outcome === null) {
    const step = Math.min(state.currentStep, total - 1)
    state.currentStep = step
    logDecision(state, 'CONTINUE', 'start-or-resume')
    return { action: 'CONTINUE', step }
  }

  const step = Math.min(state.currentStep, total - 1)
  if (outcome.ok) {
    if (!state.doneSteps.includes(step)) state.doneSteps.push(step)
    if (step >= total - 1) {
      logDecision(state, 'FINISH', 'last-step-done')
      return { action: 'FINISH', reason: 'last-step-done' }
    }
    state.currentStep = step + 1
    logDecision(state, 'CONTINUE', `step-${step}-ok`)
    return { action: 'CONTINUE', step: step + 1 }
  }

  const attempts = (state.retries[step] ?? 0) + 1
  state.retries[step] = attempts
  if (attempts < MAX_ATTEMPTS_PER_STEP) {
    state.currentStep = step
    logDecision(state, 'RETRY', `step-${step}-attempt-${attempts}`)
    return { action: 'RETRY', step, attempt: attempts }
  }
  state.failedSteps[step] = outcome.error ?? 'unknown error'
  if (step >= total - 1) {
    logDecision(state, 'FINISH', `step-${step}-exhausted`)
    return { action: 'FINISH', reason: `step-${step}-exhausted` }
  }
  state.currentStep = step + 1
  logDecision(state, 'CONTINUE', `step-${step}-failed-skip`)
  return { action: 'CONTINUE', step: step + 1 }
}

/** Replace the remaining plan with a revised one (model-generated). */
export function applyReplan(
  state: AgentRunState,
  newSteps: AgentPlanStep[]
): AgentRunState {
  const kept = state.plan.slice(0, state.currentStep)
  const fresh = newSteps
    .filter(s => s.title.trim().length > 0)
    .slice(0, 8)
    .map(s => ({
      title: s.title.slice(0, 120),
      detail: s.detail.slice(0, 500)
    }))
  logDecision(state, 'REPLAN', `revised-from-step-${state.currentStep}`)
  return {
    ...state,
    plan: [...kept, ...fresh],
    failedSteps: {},
    updatedAt: Date.now()
  }
}

/** Pause for a genuine user clarification (WAITING_USER). */
export function requestClarification(
  state: AgentRunState,
  question: string
): AgentRunState {
  logDecision(state, 'CLARIFY', question.slice(0, 140))
  return { ...state, status: 'waiting-user', updatedAt: Date.now() }
}

export interface VerifyOutcome {
  passed: boolean
  notes: string
}

/** Parse a VERDICT-led verification text (format enforced on the model). */
export function parseVerdict(text: string): VerifyOutcome {
  const passed = /^VERDICT:\s*COMPLETED/i.test(text.trim())
  const notes =
    text
      .replace(/^VERDICT:\s*(COMPLETED|INCOMPLETE)\s*/i, '')
      .trim()
      .slice(0, 2000) || text.trim().slice(0, 2000)
  return { passed, notes }
}

/** Apply a verification verdict; FAIL returns to the decision loop. */
export function applyVerification(
  state: AgentRunState,
  verdict: VerifyOutcome
): AgentRunState {
  return {
    ...state,
    verification: verdict,
    result: verdict.passed ? state.result : null,
    updatedAt: Date.now()
  }
}

/** Visible todos derived from REAL execution state (no duplicate store). */
export function runStateToTodos(state: AgentRunState): Array<{
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'medium'
  timestamp: string
}> {
  const now = new Date().toISOString()
  return state.plan.map((step, i) => ({
    id: `step-${i}`,
    content: step.title,
    status: state.doneSteps.includes(i)
      ? ('completed' as const)
      : i === state.currentStep && state.status === 'running'
        ? ('in_progress' as const)
        : ('pending' as const),
    priority: 'medium' as const,
    timestamp: now
  }))
}

// ---------------------------------------------------------------------------
// Intelligent routing: the full loop runs ONLY for real tasks. Simple
// questions stay on the fast direct path (the Discussion tab already
// works this way — this helper makes the rule explicit + tested).
// ---------------------------------------------------------------------------

const SIMPLE_PATTERNS = [
  /^(bonjour|salut|coucou|hello|hi|hey|merci|thanks|ok|oui|non)[\s!.,?]*$/i,
  /^(qui|quoi|que|quel(le)?s?|comment|pourquoi|quand|où|combien|est-ce que|what|who|when|where|why|how)\b/i,
  /\?\s*$/
]

const TASK_SIGNALS = [
  /recherche|compare|analyse|résume|synthèse|écris|rédige|crée|génère|construis|planifie|organise|étudie|enquête|trouve/i,
  /search|compare|analyze|summar|write|create|generate|build|plan|research|investigate|find/i,
  /\n.+(\n.+)+/,
  /^.{220,}/
]

export function routeGoal(goal: string): {
  route: 'chat' | 'agent'
  reason: string
} {
  const text = goal.trim()
  if (!text) return { route: 'chat', reason: 'empty' }
  if (TASK_SIGNALS.some(re => re.test(text))) {
    return { route: 'agent', reason: 'task-signal' }
  }
  if (text.length < 140 && SIMPLE_PATTERNS.some(re => re.test(text))) {
    return { route: 'chat', reason: 'simple-question' }
  }
  return { route: 'agent', reason: 'default-complex' }
}

// ---------------------------------------------------------------------------
// Persistence shape (Firestore agentRuns collection via store.ts).
// ---------------------------------------------------------------------------

export function toStoredRun(state: AgentRunState): Record<string, unknown> {
  return { ...state }
}

export function fromStoredRun(value: unknown): AgentRunState | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.taskId !== 'string' || typeof v.goal !== 'string') return null
  if (!Array.isArray(v.plan)) return null
  const now = Date.now()
  return {
    taskId: v.taskId,
    goal: v.goal,
    plan: (v.plan as AgentPlanStep[]).filter(
      s => s && typeof s.title === 'string'
    ),
    currentStep: typeof v.currentStep === 'number' ? v.currentStep : 0,
    doneSteps: Array.isArray(v.doneSteps)
      ? v.doneSteps.filter((n): n is number => typeof n === 'number')
      : [],
    retries:
      typeof v.retries === 'object' && v.retries !== null
        ? (v.retries as Record<number, number>)
        : {},
    failedSteps:
      typeof v.failedSteps === 'object' && v.failedSteps !== null
        ? (v.failedSteps as Record<number, string>)
        : {},
    evidence: Array.isArray(v.evidence) ? v.evidence : [],
    decisionLog: Array.isArray(v.decisionLog) ? v.decisionLog : [],
    verification:
      typeof v.verification === 'object' && v.verification !== null
        ? (v.verification as { passed: boolean; notes: string })
        : null,
    result: typeof v.result === 'string' ? v.result : null,
    status:
      v.status === 'waiting-approval' ||
      v.status === 'waiting-user' ||
      v.status === 'done' ||
      v.status === 'failed' ||
      v.status === 'running'
        ? v.status
        : 'running',
    transcript: Array.isArray(v.transcript) ? v.transcript : [],
    rounds: typeof v.rounds === 'number' ? v.rounds : 0,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : now
  } as AgentRunState
}
