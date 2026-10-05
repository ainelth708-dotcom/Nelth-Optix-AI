import { describe, expect, it } from 'vitest'

import {
  canTransitionTask,
  createAgentTask,
  isTerminalTaskState,
  transitionTask
} from './task'

describe('agent task machine', () => {
  it('creates idle tasks with history seeded', () => {
    const task = createAgentTask('  Résumer ce document  ')
    expect(task.title).toBe('Résumer ce document')
    expect(task.state).toBe('IDLE')
    expect(task.progress).toBe(0)
    expect(task.history).toHaveLength(1)
    expect(task.history[0]?.state).toBe('IDLE')
  })

  it('walks a full lifecycle and stamps completion', () => {
    let task = createAgentTask('demo')
    task = transitionTask(task, 'PLANNING')
    task = transitionTask(task, 'RUNNING')
    task = transitionTask(task, 'USING_TOOL', 'web_search')
    task = transitionTask(task, 'VERIFYING')
    task = transitionTask(task, 'COMPLETED')
    expect(task.state).toBe('COMPLETED')
    expect(task.progress).toBe(100)
    expect(task.history.map(h => h.state)).toEqual([
      'IDLE',
      'PLANNING',
      'RUNNING',
      'USING_TOOL',
      'VERIFYING',
      'COMPLETED'
    ])
    expect(isTerminalTaskState(task.state)).toBe(true)
  })

  it('rejects illegal transitions loudly', () => {
    const task = createAgentTask('demo')
    expect(() => transitionTask(task, 'COMPLETED')).toThrow(
      /Illegal agent task transition/
    )
    expect(canTransitionTask('IDLE', 'COMPLETED')).toBe(false)
    expect(canTransitionTask('RUNNING', 'PAUSED')).toBe(true)
  })

  it('supports pause / resume / cancel', () => {
    let task = createAgentTask('demo')
    task = transitionTask(task, 'RUNNING')
    task = transitionTask(task, 'PAUSED')
    expect(isTerminalTaskState(task.state)).toBe(false)
    task = transitionTask(task, 'RUNNING')
    task = transitionTask(task, 'CANCELLED')
    expect(isTerminalTaskState(task.state)).toBe(true)
  })
})
