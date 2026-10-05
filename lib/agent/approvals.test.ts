import { describe, expect, it } from 'vitest'

import {
  createApprovalQueue,
  requiresApproval
} from './approvals'

describe('approval queue', () => {
  it('lets safe/notice actions through without waiting', () => {
    expect(requiresApproval('SAFE', 'NOTICE')).toBe(false)
    expect(requiresApproval('OUTBOUND', 'CONFIRM')).toBe(true)
    expect(requiresApproval('SAFE', 'CONFIRM')).toBe(true)
  })

  it('requests, lists and decides exactly once', () => {
    const queue = createApprovalQueue()
    const req = queue.request({
      taskId: 'task-1',
      tool: 'fetch',
      summary: 'Lire https://example.com',
      riskClass: 'OUTBOUND',
      riskTier: 'CONFIRM'
    })
    expect(req.status).toBe('PENDING')
    expect(queue.pending()).toHaveLength(1)
    const decided = queue.decide(req.id, 'ALLOW_ONCE')
    expect(decided.status).toBe('DECIDED')
    expect(decided.decision).toBe('ALLOW_ONCE')
    expect(queue.pending()).toHaveLength(0)
    expect(() => queue.decide(req.id, 'DENY')).toThrow(/already decided/)
  })

  it('rejects unknown requests', () => {
    const queue = createApprovalQueue()
    expect(() => queue.decide('nope', 'DENY')).toThrow(/Unknown/)
  })
})
