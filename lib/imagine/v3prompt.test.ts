import { describe, expect, it } from 'vitest'

import { buildV3Prompt } from './v3prompt'

describe('buildV3Prompt', () => {
  it('bakes variations + ratio into the prompt', () => {
    expect(buildV3Prompt('a cat', 2, '16:9')).toBe(
      'a cat (generate 2 variations, aspect ratio 16:9)'
    )
  })

  it('omits the variations clause for a single image', () => {
    expect(buildV3Prompt('a cat', 1, '1:1')).toBe('a cat (aspect ratio 1:1)')
  })

  it('leaves plain prompts untouched when nothing to add', () => {
    expect(buildV3Prompt('a cat', 1, '')).toBe('a cat')
  })

  it('trims surrounding whitespace', () => {
    expect(buildV3Prompt('  a cat  ', 3, '9:16')).toBe(
      'a cat (generate 3 variations, aspect ratio 9:16)'
    )
  })
})
