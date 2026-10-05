// Task resume across HTTP requests (serverless-compatible).
//
// A long-running task NEVER depends on the original request staying
// alive: state lives in Firestore (task snapshot + worker job events).
// resumeTask() loads both and returns a ResumePlan describing exactly
// where to continue — never blindly repeating an action that may already
// have succeeded.
import type { WorkerEvent } from './worker/types'
import type { AgentTask, AgentTaskState } from './task'

export interface ResumePlan {
  task: AgentTask
  /** Step index to continue from. */
  nextStepIndex: number
  /** True when the in-flight step must be verified before continuing. */
  needsVerification: boolean
  /** Last known worker event, if any. */
  lastEvent: WorkerEvent | null
  reason: string
}

export interface TaskSnapshot {
  task: AgentTask
  /** Total planned steps (client-known). */
  totalSteps: number
  /** Indexes already completed. */
  doneSteps: number[]
}

function stepIndexFromTranscript(transcriptLength: number): number {
  return Math.max(0, transcriptLength)
}

/**
 * Pure resume planner over loaded data (unit-tested). Callers load the
 * task snapshot + recent worker events, then act on the plan.
 */
export function planResume(input: {
  snapshot: TaskSnapshot | null
  events: WorkerEvent[]
  totalSteps: number
}): ResumePlan | { retry: false; reason: string } {
  const { snapshot, events, totalSteps } = input
  if (!snapshot) return { retry: false, reason: 'unknown-task' }
  const { task } = snapshot

  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.state)) {
    return { retry: false, reason: `terminal-${task.state.toLowerCase()}` }
  }

  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const doneSteps = [...new Set(snapshot.doneSteps)].filter(
    n => Number.isInteger(n) && n >= 0 && n < totalSteps
  )
  const nextStepIndex = Math.min(
    totalSteps,
    doneSteps.length > 0 ? Math.max(...doneSteps) + 1 : 0
  )

  // A completed job event means the step finished server-side even if the
  // HTTP response was lost: verify output, don't redo it.
  const completedTypes = new Set(['JOB_COMPLETED', 'ACTION_COMPLETED'])
  const needsVerification =
    (lastEvent !== null && completedTypes.has(lastEvent.type)) ||
    task.state === 'VERIFYING'

  if (nextStepIndex >= totalSteps && !needsVerification) {
    return { retry: false, reason: 'nothing-left-to-do' }
  }

  return {
    task,
    nextStepIndex,
    needsVerification,
    lastEvent,
    reason: needsVerification ? 'verify-then-continue' : 'continue-next-step'
  }
}

export function nextAgentStateForResume(plan: ResumePlan): AgentTaskState {
  if (plan.needsVerification) return 'VERIFYING'
  return 'RUNNING'
}
