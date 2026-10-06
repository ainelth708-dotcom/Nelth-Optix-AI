import { describe, expect, it } from 'vitest'

import { formatSkillsContext, needsCompaction } from './orchestrator'

describe('formatSkillsContext', () => {
  it('lists skills one per line within budget', () => {
    const out = formatSkillsContext(
      [
        { id: 'pdf', description: 'Read and build PDF documents' },
        { id: 'frontend-design', description: 'Premium web interfaces' }
      ],
      600
    )
    expect(out).toContain('- pdf: Read and build PDF documents')
    expect(out).toContain('- frontend-design: Premium web interfaces')
  })

  it('truncates long descriptions and respects the budget', () => {
    const out = formatSkillsContext(
      [{ id: 'a', description: 'x'.repeat(500) }],
      100
    )
    expect(out.length).toBeLessThanOrEqual(100)
  })

  it('returns empty string for no skills', () => {
    expect(formatSkillsContext([])).toBe('')
  })
})

describe('needsCompaction', () => {
  it('triggers past the threshold only', () => {
    expect(needsCompaction([{ text: 'x'.repeat(100) }], 90)).toBe(true)
    expect(needsCompaction([{ text: 'x'.repeat(100) }], 100)).toBe(false)
    expect(needsCompaction([])).toBe(false)
  })
})
