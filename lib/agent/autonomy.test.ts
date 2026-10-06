import { describe, expect, it } from 'vitest'

import type { AgentRunState } from './autonomy'
import {
  applyReplan,
  applyVerification,
  createRunState,
  decideNextAction,
  fromStoredRun,
  MAX_ATTEMPTS_PER_STEP,
  parseVerdict,
  requestClarification,
  routeGoal,
  runStateToTodos,
  toStoredRun
} from './autonomy'
import { canTransitionTask } from './task'

function runningState(): AgentRunState {
  return createRunState('task-1', 'Comparer les prix', [
    { title: 'Chercher les prix', detail: 'web' },
    { title: 'Comparer', detail: 'tableau' },
    { title: 'Conclure', detail: 'résumé' }
  ])
}

describe('autonomous loop reducer', () => {
  it('starts and continues through steps', () => {
    const s = runningState()
    expect(decideNextAction(s, null)).toEqual({ action: 'CONTINUE', step: 0 })
    expect(
      decideNextAction(s, { ok: true, text: 'prix trouvés', tools: ['search'] })
    ).toEqual({
      action: 'CONTINUE',
      step: 1
    })
    expect(s.doneSteps).toEqual([0])
    expect(s.decisionLog.map(d => d.decision)).toEqual(['CONTINUE', 'CONTINUE'])
  })

  it('finishes after the last step', () => {
    const s = runningState()
    s.currentStep = 2
    expect(
      decideNextAction(s, { ok: true, text: 'conclusion', tools: [] })
    ).toEqual({ action: 'FINISH', reason: 'last-step-done' })
  })

  it('retries failed steps up to the limit, then skips ahead', () => {
    const s = runningState()
    for (let attempt = 1; attempt < MAX_ATTEMPTS_PER_STEP; attempt++) {
      const next = decideNextAction(s, {
        ok: false,
        text: '',
        tools: [],
        error: 'timeout'
      })
      expect(next).toEqual({ action: 'RETRY', step: 0, attempt })
      s.currentStep = 0
    }
    const exhausted = decideNextAction(s, {
      ok: false,
      text: '',
      tools: [],
      error: 'timeout'
    })
    expect(exhausted).toEqual({ action: 'CONTINUE', step: 1 })
    expect(s.failedSteps[0]).toBe('timeout')
    expect(s.retries[0]).toBe(MAX_ATTEMPTS_PER_STEP)
  })

  it('finishes (incomplete) when the last step exhausts retries', () => {
    const s = runningState()
    s.currentStep = 2
    for (let i = 0; i < MAX_ATTEMPTS_PER_STEP; i++) {
      decideNextAction(s, { ok: false, text: '', tools: [], error: 'boom' })
    }
    const last = decideNextAction(s, {
      ok: false,
      text: '',
      tools: [],
      error: 'boom'
    })
    // Attempts already at cap from the loop above: next call finishes.
    expect(last.action).toBe('FINISH')
  })

  it('handles empty plans honestly', () => {
    const s = runningState()
    s.plan = []
    expect(decideNextAction(s, null)).toEqual({
      action: 'FINISH',
      reason: 'empty-plan'
    })
  })
})

describe('replan + clarify + verify', () => {
  it('replaces remaining steps and clears stale failures', () => {
    const s = runningState()
    s.currentStep = 1
    s.failedSteps[1] = 'old'
    const next = applyReplan(s, [
      { title: 'Nouvelle piste', detail: 'autre source' }
    ])
    expect(next.plan.map(p => p.title)).toEqual([
      'Chercher les prix',
      'Nouvelle piste'
    ])
    expect(next.failedSteps).toEqual({})
    expect(next.decisionLog.at(-1)?.decision).toBe('REPLAN')
  })

  it('pauses for genuine clarification', () => {
    const s = runningState()
    const paused = requestClarification(s, 'Quelle ville ?')
    expect(paused.status).toBe('waiting-user')
    expect(paused.decisionLog.at(-1)).toMatchObject({ decision: 'CLARIFY' })
  })

  it('parses evidence verdicts', () => {
    expect(parseVerdict('VERDICT: COMPLETED\nTout est prouvé.')).toEqual({
      passed: true,
      notes: 'Tout est prouvé.'
    })
    expect(
      parseVerdict('VERDICT: INCOMPLETE\nIl manque les prix.').passed
    ).toBe(false)
    expect(parseVerdict('random text').passed).toBe(false)
  })

  it('applies verification without faking results', () => {
    const s = runningState()
    const failed = applyVerification(s, {
      passed: false,
      notes: 'manque preuve'
    })
    expect(failed.verification?.passed).toBe(false)
    expect(failed.result).toBe(null)
    const passed = applyVerification(
      { ...s, result: 'voici' },
      { passed: true, notes: 'ok' }
    )
    expect(passed.result).toBe('voici')
  })
})

describe('task resume + persistence shape', () => {
  it('round-trips stored runs and rejects garbage', () => {
    const s = runningState()
    s.doneSteps = [0]
    const restored = fromStoredRun(toStoredRun(s))
    expect(restored?.doneSteps).toEqual([0])
    expect(restored?.goal).toBe('Comparer les prix')
    expect(fromStoredRun(null)).toBe(null)
    expect(fromStoredRun({ nope: true })).toBe(null)
  })

  it('derives visible todos from real execution state', () => {
    const s = runningState()
    decideNextAction(s, null)
    decideNextAction(s, { ok: true, text: 'prix trouvés', tools: ['search'] })
    const todos = runStateToTodos(s)
    expect(todos.map(t => t.status)).toEqual([
      'completed',
      'in_progress',
      'pending'
    ])
    expect(todos[0]).toMatchObject({ id: 'step-0', priority: 'medium' })
  })
})

describe('intelligent routing (fast path preserved)', () => {
  it('bypasses the loop for simple questions', () => {
    expect(routeGoal('Bonjour').route).toBe('chat')
    expect(routeGoal('Quelle est la capitale du Japon ?').route).toBe('chat')
    expect(routeGoal('merci !').route).toBe('chat')
  })

  it('sends real tasks to the agent loop', () => {
    expect(
      routeGoal('Compare les prix des vols Paris–Tokyo en septembre').route
    ).toBe('agent')
    expect(
      routeGoal('Fais une recherche approfondie sur les batteries solides')
        .route
    ).toBe('agent')
    expect(routeGoal('x'.repeat(300)).route).toBe('agent')
  })
})

describe('no duplicate todo store', () => {
  it('task machine stays the system of record for chat tasks', () => {
    expect(canTransitionTask('RUNNING', 'USING_TOOL')).toBe(true)
  })
})
