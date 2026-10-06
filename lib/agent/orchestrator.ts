// ---------------------------------------------------------------------------
// Agent orchestrator (nanoMuse-style loop, serverless-compatible).
//
// Flow per goal: PLAN (structured steps via the existing model router) →
// per-step EXECUTION (streamText with the EXISTING tool factories —
// search/fetch/document/question, same models, no new provider) →
// VERIFY (model verdict) → result.
//
// Serverless rules: no in-process loop state. Each run/decide HTTP call
// executes a bounded slice and returns; pause/resume state (transcript +
// completed steps) travels opaquely through the client. Sensitive tools
// (fetch = OUTBOUND) throw ApprovalNeededError instead of executing: the
// run pauses, the UI approves, /api/agent/decide executes the single
// approved call and resumes the loop in the same request.
// ---------------------------------------------------------------------------

import { generateText, stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'

import { DEFAULT_MODEL } from '@/lib/config/default-model'
import { documentTool } from '@/lib/tools/document'
import { fetchTool } from '@/lib/tools/fetch'
import { createQuestionTool } from '@/lib/tools/question'
import { createSearchTool } from '@/lib/tools/search'
import { createTodoTools } from '@/lib/tools/todo'
import { getModel } from '@/lib/utils/registry'

import { getCapabilities } from './worker/capabilities'
import { requiresApproval } from './approvals'
import {
  type AgentPlanStep,
  type AgentRunState,
  type AgentTranscriptEntry,
  applyReplan,
  createRunState,
  decideNextAction,
  MAX_ATTEMPTS_PER_STEP,
  MAX_ROUNDS,
  parseVerdict,
  type StepOutcome
} from './autonomy'
import { createSkillTool } from './skills'

// Re-exported for existing importers (plan panel, routes).
export type { AgentPlanStep, AgentTranscriptEntry } from './autonomy'

const agentModelId = `${DEFAULT_MODEL.providerId}:${DEFAULT_MODEL.id}`
const agentModel = () => getModel(agentModelId)

export interface AgentPlan {
  title: string
  steps: AgentPlanStep[]
}

const PlanSchema = z.object({
  title: z.string(),
  steps: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .min(1)
    .max(8)
})

const PLANNER_SYSTEM = [
  'You are the planner of Nelth-IA, an autonomous agent.',
  'Break the user goal into a short ordered list of concrete, verifiable steps.',
  'Prefer steps executable with web search, page fetch, document lookup, or direct answering.',
  'Keep titles under 80 characters. At most 8 steps.'
].join(' ')

/**
 * Structured output WITHOUT responseFormat: several gateway models don't
 * support JSON mode (AI_NoObjectGeneratedError), so we ask for raw JSON
 * via generateText, extract the first {...} block (fenced or not),
 * validate with zod, and retry once with a stricter nudge. Works with
 * every existing provider/model.
 */
async function generateJsonObject<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string
): Promise<T> {
  const extract = (text: string): unknown => {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = (fence?.[1] ?? text).trim()
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('no-json-found')
    return JSON.parse(candidate.slice(start, end + 1))
  }
  let lastError: unknown = null
  for (let attempt = 0; attempt <= 1; attempt++) {
    const { text } = await generateText({
      model: agentModel(),
      system:
        attempt === 0
          ? `${system} Reply with a single JSON object only, no prose, no code fences.`
          : `${system} Reply with a single RAW JSON object only. No prose, no markdown, no fences, no commentary.`,
      prompt
    })
    try {
      const parsed = schema.safeParse(normalizeForSchema(extract(text)))
      if (parsed.success) return parsed.data
      lastError = parsed.error
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(
    `Invalid model JSON: ${lastError instanceof Error ? lastError.message : 'unparseable'}`
  )
}

/**
 * Lenient shape coercion: models return the same plan under different
 * key names ({step, description}, plain strings, nested {plan}). Coerce
 * to the canonical shape BEFORE zod validation so strict schemas still
 * apply to real content. Exported for tests.
 */
export function normalizeForSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { title: 'Plan', steps: value.map(coerceStep).filter(Boolean) }
  }
  if (typeof value !== 'object' || value === null) return value
  const v = value as Record<string, unknown>
  const inner =
    v.steps ??
    v.tasks ??
    (v.plan as Record<string, unknown> | undefined)?.steps ??
    v.items
  const steps = Array.isArray(inner)
    ? inner
        .map(coerceStep)
        .filter((s): s is { title: string; detail: string } => s !== null)
    : []
  const title =
    [
      v.title,
      v.name,
      (v.plan as Record<string, unknown> | undefined)?.title
    ].find(t => typeof t === 'string' && (t as string).trim()) ?? 'Plan'
  return { ...v, title, steps }
}

function coerceStep(item: unknown): { title: string; detail: string } | null {
  if (typeof item === 'string') {
    const title = item.trim().slice(0, 120)
    return title ? { title, detail: '' } : null
  }
  if (typeof item !== 'object' || item === null) return null
  const o = item as Record<string, unknown>
  const title = [o.title, o.step, o.name, o.task, o.action].find(
    t => typeof t === 'string' && (t as string).trim()
  ) as string | undefined
  if (!title) return null
  const detail = [o.detail, o.description, o.desc, o.summary].find(
    t => typeof t === 'string'
  ) as string | undefined
  return {
    title: title.trim().slice(0, 120),
    detail: (detail ?? '').trim().slice(0, 500)
  }
}

export async function planGoal(goal: string): Promise<AgentPlan> {
  const trimmed = goal.trim()
  if (!trimmed) throw new Error('Objectif vide.')
  // The planner only proposes what REALLY exists: available worker
  // capabilities are injected live (never hardcoded), so plans never
  // promise browser/shell/computer work when no worker is configured.
  const caps = getCapabilities()
  const available = [
    'web search',
    'page fetch (approved)',
    'document lookup',
    'direct answering'
  ]
  if (caps.browser) available.push('browser automation (worker)')
  if (caps.computer) available.push('computer control (worker)')
  if (caps.shell)
    available.push(
      `shell commands (worker${caps.proot ? ', proot isolated' : ''})`
    )
  const object = await generateJsonObject(
    PlanSchema,
    PLANNER_SYSTEM,
    `${trimmed}\n\nAvailable capabilities: ${available.join(', ')}. ` +
      'Plan ONLY with these — never assume browser, shell or computer access unless listed.'
  )
  return object
}

export interface PendingToolCall {
  tool: string
  args: Record<string, unknown>
}

export class ApprovalNeededError extends Error {
  readonly call: PendingToolCall
  constructor(call: PendingToolCall) {
    super(`Approval needed: ${call.tool}`)
    this.name = 'ApprovalNeededError'
    this.call = call
  }
}

// fetch = OUTBOUND: never auto-executed, always gated.
const gatedFetchTool = tool({
  description: fetchTool.description,
  inputSchema: z.object({
    url: z.string(),
    type: z.enum(['regular', 'api']).optional()
  }),
  execute: async (args: {
    url: string
    type?: 'regular' | 'api'
  }): Promise<unknown> => {
    throw new ApprovalNeededError({
      tool: 'fetch',
      args: { url: args.url, type: args.type ?? 'regular' }
    })
  }
})

export class QuestionNeededError extends Error {
  readonly question: string
  readonly options: string[]
  constructor(question: string, options: string[] = []) {
    super(`Clarification needed: ${question}`)
    this.name = 'QuestionNeededError'
    this.question = question
    this.options = options
  }
}

// question = genuine clarification: the model explicitly asks instead of
// guessing. Thrown (like approvals) so the run pauses for a real answer
// instead of stalling on a tool without execute.
const questionToolInstance = createQuestionTool(agentModelId)
const gatedQuestionTool = tool({
  description: questionToolInstance.description,
  inputSchema: z.object({
    question: z.string(),
    options: z.array(z.string()).optional()
  }),
  execute: async (args: unknown): Promise<unknown> => {
    const a = (typeof args === 'object' && args !== null ? args : {}) as {
      question?: unknown
      options?: unknown
      text?: unknown
    }
    const question =
      typeof a.question === 'string' && a.question.trim()
        ? a.question.trim()
        : typeof a.text === 'string' && a.text.trim()
          ? a.text.trim()
          : 'Peux-tu préciser ta demande ?'
    const options = Array.isArray(a.options)
      ? a.options.filter((o): o is string => typeof o === 'string').slice(0, 6)
      : []
    throw new QuestionNeededError(question, options)
  }
})

function agentTools() {
  return {
    search: createSearchTool(agentModelId),
    fetch: gatedFetchTool,
    document: documentTool,
    question: gatedQuestionTool,
    skill: createSkillTool(),
    ...createTodoTools()
  }
}

/** Static risk map mirrors approvals.requiresApproval (fetch gated). */
export function toolRisk(toolName: string): {
  riskClass: 'SAFE' | 'OUTBOUND'
  tier: 'NOTICE' | 'CONFIRM'
} {
  if (toolName === 'fetch') return { riskClass: 'OUTBOUND', tier: 'CONFIRM' }
  return { riskClass: 'SAFE', tier: 'NOTICE' }
}

export function toolNeedsApproval(toolName: string): boolean {
  const { riskClass, tier } = toolRisk(toolName)
  return requiresApproval(
    riskClass as 'SAFE' | 'OUTBOUND',
    tier as 'NOTICE' | 'CONFIRM'
  )
}

export interface AgentRunResume {
  transcript: AgentTranscriptEntry[]
  startIndex: number
}

export type AgentRunEvent =
  | { type: 'step-start'; index: number; title: string }
  | { type: 'step-text'; index: number; text: string }
  | {
      type: 'tool-call'
      index: number
      tool: string
      auto: boolean
    }
  | { type: 'step-done'; index: number; text: string }
  | { type: 'decide'; decision: string; reason: string }
  | { type: 'retry'; index: number; attempt: number }
  | { type: 'replan'; steps: AgentPlanStep[] }
  | { type: 'verify' }
  | { type: 'clarify'; index: number; question: string; options: string[] }
  | {
      type: 'approval-needed'
      index: number
      call: PendingToolCall
      resume: AgentRunResume
    }
  | { type: 'done'; verdict: string; completed: boolean }
  | { type: 'error'; message: string }

const MAX_STEPS_PER_RUN = 8
const TRANSCRIPT_CHARS = 6000

function transcriptPrompt(
  goal: string,
  transcript: AgentTranscriptEntry[]
): string {
  const tail = transcript
    .map(e => `${e.role.toUpperCase()}: ${e.text}`.slice(0, 1500))
    .join('\n')
    .slice(-TRANSCRIPT_CHARS)
  return `Goal: ${goal}\n${tail ? `So far:\n${tail}\n` : ''}`
}

const RUNNER_SYSTEM = [
  'You are Nelth-IA, an autonomous agent executing ONE step now.',
  'Use the available tools when they help (search the web, fetch a page, look up documents, load a skill playbook, track todos).',
  'Be concise: report what you did and the key finding in a few sentences.',
  'Never claim actions you did not take. No chain-of-thought, only the outcome.'
].join(' ')

const VERIFIER_SYSTEM = [
  'You judge whether the user goal is achieved given the transcript.',
  'Answer with a verdict: COMPLETED or INCOMPLETE, then one short paragraph.',
  'Format exactly: "VERDICT: <COMPLETED|INCOMPLETE>" on the first line, then the summary.'
].join(' ')

const RecoverySchema = z.object({
  decision: z.enum(['retry', 'replan', 'finish', 'clarify']).catch('finish'),
  reason: z.string().catch(''),
  retryIndex: z.number().int().min(0).max(7).nullable().optional().catch(null),
  revisedSteps: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .min(1)
    .max(8)
    .nullable()
    .optional()
    .catch(null),
  question: z.string().nullable().optional().catch(null)
})

type Recovery = z.infer<typeof RecoverySchema>

async function decideRecovery(
  goal: string,
  state: AgentRunState
): Promise<Recovery> {
  const evidence = state.evidence
    .map(e => `step ${e.step} [${e.tool}]: ${e.summary}`)
    .join('\n')
    .slice(-3000)
  const failures =
    Object.entries(state.failedSteps)
      .map(([i, e]) => `step ${i}: ${e}`)
      .join('\n') || '(none)'
  const object = await generateJsonObject(
    RecoverySchema,
    'You salvage a stuck autonomous task. Prefer the smallest fix: retry the failed step, revise the remaining plan, ask ONE precise question, or finish as incomplete.',
    `Goal: ${goal}\nEvidence so far:\n${evidence || '(none)'}\n` +
      `Failed steps:\n${failures}\n` +
      'Decide: retry (which step index?), replan (revised steps), clarify (one question), or finish.'
  )
  return object
}

async function* executeStep(
  goal: string,
  transcript: AgentTranscriptEntry[],
  steps: AgentPlanStep[],
  index: number
): AsyncGenerator<AgentRunEvent, StepOutcome, void> {
  const step = steps[index]
  const stepPrompt =
    `${transcriptPrompt(goal, transcript)}\n` +
    `Current step ${index + 1}/${steps.length}: ${step.title}. ${step.detail}\n` +
    'Execute it now.'
  const stream = streamText({
    model: agentModel(),
    system: RUNNER_SYSTEM,
    prompt: stepPrompt,
    tools: agentTools(),
    stopWhen: stepCountIs(3)
  })
  let stepText = ''
  const tools: string[] = []
  const toolNotes: string[] = []
  for await (const part of stream.fullStream) {
    if (part.type === 'text-delta') {
      stepText += (part as { text?: string }).text ?? ''
      if (stepText.length % 240 < 60) {
        yield { type: 'step-text', index, text: stepText.slice(-240) }
      }
    } else if (part.type === 'tool-call') {
      const name = (part as { toolName?: string }).toolName ?? 'outil'
      tools.push(name)
      yield {
        type: 'tool-call',
        index,
        tool: name,
        auto: !toolNeedsApproval(name)
      }
    } else if (part.type === 'tool-result') {
      const r = part as { toolName?: string; output?: unknown }
      const out =
        typeof r.output === 'string'
          ? r.output
          : JSON.stringify(r.output ?? null)
      toolNotes.push(`${r.toolName ?? 'outil'}: ${out.slice(0, 800)}`)
    }
  }
  const text =
    stepText.trim() +
    (toolNotes.length > 0 ? `\nTool notes: ${toolNotes.join(' | ')}` : '')
  return { ok: true, text: text.trim(), tools }
}

/**
 * Autonomous loop: PLAN → EXECUTE → OBSERVE → DECIDE → CONTINUE / RETRY
 * / REPLAN / CLARIFY / FINISH → VERIFY → VERIFIED RESULT.
 *
 * No fixed step count: MAX_ROUNDS and per-step attempt caps are safety
 * budgets, not plan length. Approval/question pauses surface as events;
 * the caller resumes through the same entrypoint. Pure orchestration
 * over existing models/tools — no new provider.
 */
export async function* runGoalStream(input: {
  goal: string
  steps: AgentPlanStep[]
  taskId?: string
  resume?: AgentRunResume
  persist?: (state: AgentRunState) => Promise<void> | void
}): AsyncGenerator<AgentRunEvent> {
  const goal = input.goal.trim()
  if (!goal) throw new Error('Objectif vide.')
  const steps = input.steps.slice(0, MAX_STEPS_PER_RUN)
  if (steps.length === 0) throw new Error('Aucune étape à exécuter.')

  const state = createRunState(
    typeof input.taskId === 'string' && input.taskId
      ? input.taskId
      : `run-${Date.now().toString(36)}`,
    goal,
    steps
  )
  for (const e of input.resume?.transcript ?? []) {
    state.transcript.push({
      role: e.role,
      text: String(e.text ?? '').slice(0, 3000)
    })
  }
  if (input.resume) {
    const idx = Math.min(Math.max(0, input.resume.startIndex), steps.length - 1)
    state.currentStep = idx
    state.doneSteps = Array.from({ length: idx }, (_, i) => i)
  }
  const persist = async () => {
    state.updatedAt = Date.now()
    await input.persist?.(state)
  }

  let outcome: StepOutcome | null = null
  while (true) {
    if (state.rounds >= MAX_ROUNDS) break
    const next = decideNextAction(state, outcome)
    if (next.action === 'FINISH') break
    yield {
      type: 'decide',
      decision: next.action,
      reason:
        next.action === 'RETRY'
          ? `tentative ${next.attempt}`
          : `étape ${next.step + 1}`
    }
    const stepIdx = next.step
    if (next.action === 'RETRY') {
      yield { type: 'retry', index: stepIdx, attempt: next.attempt }
    }
    const step = state.plan[stepIdx]
    state.rounds += 1
    await persist()
    yield { type: 'step-start', index: stepIdx, title: step.title }
    try {
      const it = executeStep(goal, state.transcript, state.plan, stepIdx)
      for (;;) {
        const n = await it.next()
        if (n.done) {
          outcome = n.value
          break
        }
        yield n.value
      }
    } catch (err) {
      if (err instanceof ApprovalNeededError) {
        yield {
          type: 'approval-needed',
          index: stepIdx,
          call: err.call,
          resume: { transcript: state.transcript, startIndex: stepIdx }
        }
        state.status = 'waiting-approval'
        await persist()
        return
      }
      if (err instanceof QuestionNeededError) {
        yield {
          type: 'clarify',
          index: stepIdx,
          question: err.question,
          options: err.options
        }
        state.status = 'waiting-user'
        await persist()
        return
      }
      outcome = {
        ok: false,
        text: '',
        tools: [],
        error: err instanceof Error ? err.message : 'step failed'
      }
    }
  }

  // VERIFY against collected evidence; on FAIL with budget left, ask the
  // model to recover (retry a step / replan / clarify / finish).
  yield { type: 'verify' }
  const { text: verdictRaw } = await verifyGoal(goal, state.transcript)
  const parsed = parseVerdict(verdictRaw)
  state.verification = parsed
  if (!parsed.passed && state.rounds < MAX_ROUNDS) {
    const fix = await decideRecovery(goal, state)
    if (fix.decision === 'clarify' && fix.question) {
      yield {
        type: 'clarify',
        index: state.currentStep,
        question: fix.question,
        options: []
      }
      state.status = 'waiting-user'
      await persist()
      return
    }
    if (
      fix.decision === 'replan' &&
      fix.revisedSteps &&
      fix.revisedSteps.length > 0
    ) {
      const revised = fix.revisedSteps
        .map(s => ({
          title: String(s.title ?? '').slice(0, 120),
          detail: String(s.detail ?? '').slice(0, 500)
        }))
        .filter(s => s.title.length > 0)
      if (revised.length > 0) {
        const applied = applyReplan(state, revised)
        state.plan = applied.plan
        state.failedSteps = applied.failedSteps
        yield { type: 'replan', steps: state.plan }
        yield {
          type: 'decide',
          decision: 'REPLAN',
          reason: fix.reason.slice(0, 200)
        }
        await persist()
        yield* runGoalStream({
          goal,
          steps: state.plan,
          taskId: state.taskId,
          resume: {
            transcript: state.transcript,
            startIndex: state.currentStep
          },
          persist: input.persist
        })
        return
      }
    }
    if (fix.decision === 'retry' && fix.retryIndex != null) {
      const idx = Math.min(Math.max(0, fix.retryIndex), state.plan.length - 1)
      state.currentStep = idx
      state.retries[idx] = Math.max(0, MAX_ATTEMPTS_PER_STEP - 1)
      delete state.failedSteps[idx]
      yield {
        type: 'decide',
        decision: 'RETRY',
        reason: fix.reason.slice(0, 200)
      }
      await persist()
      yield* runGoalStream({
        goal,
        steps: state.plan,
        taskId: state.taskId,
        resume: { transcript: state.transcript, startIndex: idx },
        persist: input.persist
      })
      return
    }
    yield {
      type: 'decide',
      decision: 'FINISH',
      reason: fix.reason.slice(0, 200)
    }
  }

  const notes = parsed.notes || verdictRaw.trim()
  state.status = 'done'
  state.result = parsed.passed ? notes : null
  await persist()
  yield { type: 'done', verdict: notes, completed: parsed.passed }
}

async function verifyGoal(
  goal: string,
  transcript: AgentTranscriptEntry[]
): Promise<{ text: string }> {
  const { text } = await generateText({
    model: agentModel(),
    system: VERIFIER_SYSTEM,
    prompt:
      `Goal: ${goal}\nTranscript:\n` +
      transcript
        .map(e => `${e.role.toUpperCase()}: ${e.text}`.slice(0, 1500))
        .join('\n')
        .slice(-TRANSCRIPT_CHARS)
  })
  return { text }
}

/** Drain the real fetch tool for an approved call (server-side). */
export async function executeApprovedFetch(
  args: Record<string, unknown>
): Promise<string> {
  const url = typeof args.url === 'string' ? args.url : ''
  const type = args.type === 'api' ? 'api' : 'regular'
  if (!/^https?:\/\//.test(url)) throw new Error('URL invalide.')
  let last: unknown = null
  const gen = fetchTool.execute as unknown as (
    a: unknown,
    o: unknown
  ) => AsyncGenerator<unknown>
  for await (const chunk of gen(
    { url, type },
    { toolCallId: 'approved', messages: [], abortSignal: undefined }
  )) {
    last = chunk
  }
  const done = last as {
    state?: string
    results?: Array<{ title?: string; content?: string; url?: string }>
  } | null
  const first = done?.results?.[0]
  if (!first?.content) throw new Error('Lecture impossible.')
  return `${first.title ?? url}\n${first.content}`.slice(0, 3000)
}
