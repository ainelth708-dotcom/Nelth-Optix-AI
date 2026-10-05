import { describe, expect, it } from 'vitest'

import type { WorkerEvent } from './worker/types'
import { planResume } from './runtime'
import type { AgentTask } from './task'

function task(state: AgentTask['state']): AgentTask {
  const now = Date.now()
  return {
    id: 'task-1',
    title: 'demo',
    goalId: null,
    state,
    progress: 0,
    steps: [],
    artifacts: [],
    history: [{ state, at: now }],
    result: null,
    createdAt: now,
    updatedAt: now
  }
}

function workerEvent(type: WorkerEvent['type'], jobId = 'job-1'): WorkerEvent {
  return {
    eventId: `evt-${type}-${jobId}`,
    jobId,
    taskId: 'task-1',
    type,
    at: Date.now(),
    payload: {}
  }
}

describe('resume planner', () => {
  it('refuses unknown tasks', () => {
    expect(planResume({ snapshot: null, events: [], totalSteps: 3 })).toEqual({
      retry: false,
      reason: 'unknown-task'
    })
  })

  it('refuses terminal tasks', () => {
    const plan = planResume({
      snapshot: {
        task: task('COMPLETED'),
        totalSteps: 3,
        doneSteps: [0, 1, 2]
      },
      events: [],
      totalSteps: 3
    })
    expect(plan).toEqual({ retry: false, reason: 'terminal-completed' })
  })

  it('continues after the last done step', () => {
    const plan = planResume({
      snapshot: { task: task('RUNNING'), totalSteps: 4, doneSteps: [0, 1] },
      events: [workerEvent('ACTION_COMPLETED')],
      totalSteps: 4
    })
    expect(plan).toEqual({
      task: expect.objectContaining({ id: 'task-1' }),
      nextStepIndex: 2,
      needsVerification: true,
      lastEvent: expect.objectContaining({ type: 'ACTION_COMPLETED' }),
      reason: 'verify-then-continue'
    })
  })

  it('starts fresh work at step zero without verification', () => {
    const plan = planResume({
      snapshot: { task: task('RUNNING'), totalSteps: 2, doneSteps: [] },
      events: [],
      totalSteps: 2
    })
    expect(plan).toMatchObject({
      nextStepIndex: 0,
      needsVerification: false,
      reason: 'continue-next-step'
    })
  })

  it('reports nothing left when all steps are done', () => {
    const plan = planResume({
      snapshot: { task: task('RUNNING'), totalSteps: 1, doneSteps: [0] },
      events: [workerEvent('OUTPUT')],
      totalSteps: 1
    })
    expect(plan).toEqual({ retry: false, reason: 'nothing-left-to-do' })
  })
})
