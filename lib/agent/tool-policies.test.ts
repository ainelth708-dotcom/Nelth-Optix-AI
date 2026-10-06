import { describe, expect, it } from 'vitest'

import {
  AGENT_TOOL_POLICIES,
  toolApprovalPolicy,
  toolLabel
} from './tool-policies'

describe('tool policies', () => {
  it('gates fetch every time and never auto-answers questions', () => {
    expect(toolApprovalPolicy('fetch')).toBe('once')
    expect(toolApprovalPolicy('question')).toBe('never')
    expect(toolApprovalPolicy('search')).toBe('auto')
    expect(toolApprovalPolicy('document')).toBe('auto')
    expect(toolApprovalPolicy('skill')).toBe('auto')
    expect(toolApprovalPolicy('todoWrite')).toBe('auto')
  })

  it('falls back safely for unknown tools', () => {
    expect(toolApprovalPolicy('nope')).toBe('auto')
    expect(toolLabel('nope')).toBe('nope')
  })

  it('labels every policy for the activity UI', () => {
    for (const policy of Object.values(AGENT_TOOL_POLICIES)) {
      expect(policy.label.length).toBeGreaterThan(0)
    }
    expect(toolLabel('fetch')).toBe('Lecture de page')
  })
})
