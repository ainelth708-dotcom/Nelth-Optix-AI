// Agent tool policies (eve-style envelope, adapted to our RiskGate).
//
// Every tool in the agent toolbox declares a fixed policy:
// - auto: executes immediately (SAFE/NOTICE).
// - once: pauses for approval on every call (OUTBOUND fetch).
// - never: never executes — always pauses for user input (question).
// Plus a human label used by the activity UI. Single source of truth
// next to approvals.ts; the orchestrator enforces it.

export type ToolApprovalPolicy = 'auto' | 'once' | 'never'

export interface AgentToolPolicy {
  tool: string
  label: string
  policy: ToolApprovalPolicy
}

export const AGENT_TOOL_POLICIES: Record<string, AgentToolPolicy> = {
  search: { tool: 'search', label: 'Recherche web', policy: 'auto' },
  fetch: { tool: 'fetch', label: 'Lecture de page', policy: 'once' },
  document: { tool: 'document', label: 'Documents', policy: 'auto' },
  question: { tool: 'question', label: 'Question', policy: 'never' },
  skill: { tool: 'skill', label: 'Compétence', policy: 'auto' },
  todoWrite: { tool: 'todoWrite', label: 'Suivi', policy: 'auto' }
}

export function toolApprovalPolicy(toolName: string): ToolApprovalPolicy {
  return AGENT_TOOL_POLICIES[toolName]?.policy ?? 'auto'
}

/** Human label for activity streams; falls back to the raw tool name. */
export function toolLabel(toolName: string): string {
  return AGENT_TOOL_POLICIES[toolName]?.label ?? toolName
}
