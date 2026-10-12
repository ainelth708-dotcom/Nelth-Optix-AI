import { describe, expect, test } from 'vitest'

import { classifyVisualIntent } from './visual-intent'

describe('classifyVisualIntent', () => {
  test.each(['Bonjour', 'What is 2 + 2?', 'Translate this sentence'])(
    'keeps "%s" as a text response',
    prompt => {
      expect(classifyVisualIntent(prompt).intent).toBe('not_needed')
    }
  )

  test.each([
    'Show this data as a chart',
    'Create a tip calculator',
    'Compare these three models'
  ])('enables a useful native UI for "%s"', prompt => {
    expect(classifyVisualIntent(prompt).intent).not.toBe('not_needed')
  })
})
