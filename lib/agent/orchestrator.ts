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

import { generateObject, generateText, stepCountIs, streamText, tool } from 'ai'
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
import { createSkillTool } from './skills'

const agentModelId = `${DEFAULT_MODEL.providerId}:${DEFAULT_MODEL.id}`
const agentModel = () => getModel(agentModelId)

export interface AgentPlanStep {
  title: string
  detail: string
}

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
  const { object } = await generateObject({
    model: agentModel(),
    schema: PlanSchema,
    system: PLANNER_SYSTEM,
    prompt:
      `${trimmed}\n\nAvailable capabilities: ${available.join(', ')}. ` +
      'Plan ONLY with these — never assume browser, shell or computer access unless listed.'
  })
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

function agentTools() {
  return {
    search: createSearchTool(agentModelId),
    fetch: gatedFetchTool,
    document: documentTool,
    question: createQuestionTool(agentModelId),
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

export interface AgentTranscriptEntry {
  role: 'user' | 'assistant' | 'observation'
  text: string
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

/**
 * Bounded run generator: yields live events per planned step. Throws
 * ApprovalNeededError as an `approval-needed` event (never raw). Pure
 * orchestration over existing models/tools — no new provider.
 */
export async function* runGoalStream(input: {
  goal: string
  steps: AgentPlanStep[]
  resume?: AgentRunResume
}): AsyncGenerator<AgentRunEvent> {
  const goal = input.goal.trim()
  if (!goal) throw new Error('Objectif vide.')
  const steps = input.steps.slice(0, MAX_STEPS_PER_RUN)
  if (steps.length === 0) throw new Error('Aucune étape à exécuter.')

  const transcript: AgentTranscriptEntry[] = [
    ...(input.resume?.transcript ?? [])
  ]
  const startIndex = Math.min(input.resume?.startIndex ?? 0, steps.length)

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i]
    yield { type: 'step-start', index: i, title: step.title }
    const stepPrompt =
      `${transcriptPrompt(goal, transcript)}\n` +
      `Current step ${i + 1}/${steps.length}: ${step.title}. ${step.detail}\n` +
      `Execute it now.`
    try {
      const stream = streamText({
        model: agentModel(),
        system: RUNNER_SYSTEM,
        prompt: stepPrompt,
        tools: agentTools(),
        stopWhen: stepCountIs(3)
      })
      let stepText = ''
      const toolNotes: string[] = []
      for await (const part of stream.fullStream) {
        if (part.type === 'text-delta') {
          stepText += (part as { text?: string }).text ?? ''
          if (stepText.length % 240 < 60) {
            yield { type: 'step-text', index: i, text: stepText.slice(-240) }
          }
        } else if (part.type === 'tool-call') {
          const call = part as { toolName?: string }
          yield {
            type: 'tool-call',
            index: i,
            tool: call.toolName ?? 'outil',
            auto: !toolNeedsApproval(call.toolName ?? '')
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
      const finalText = stepText.trim()
      transcript.push({
        role: 'assistant',
        text:
          `Step "${step.title}": ${finalText || '(no text output)'}` +
          (toolNotes.length > 0 ? `\nTool notes: ${toolNotes.join(' | ')}` : '')
      })
      yield {
        type: 'step-done',
        index: i,
        text: transcript[transcript.length - 1]?.text ?? ''
      }
    } catch (err) {
      if (err instanceof ApprovalNeededError) {
        yield {
          type: 'approval-needed',
          index: i,
          call: err.call,
          resume: { transcript, startIndex: i }
        }
        return
      }
      throw err
    }
  }

  const { text: verdictRaw } = await verifyGoal(goal, transcript)
  const completed = /^VERDICT:\s*COMPLETED/i.test(verdictRaw.trim())
  yield {
    type: 'done',
    verdict:
      verdictRaw.replace(/^VERDICT:\s*(COMPLETED|INCOMPLETE)\s*/i, '').trim() ||
      verdictRaw.trim(),
    completed
  }
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
