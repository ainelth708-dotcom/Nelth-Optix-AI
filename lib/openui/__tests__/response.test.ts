import { describe, expect, test } from 'vitest'

import {
  appendOpenUIContext,
  describeOpenUIContext,
  stripOpenUIContext
} from '../context'
import { extractOpenUIResponse } from '../response'

describe('OpenUI response integration', () => {
  test('extracts complete and incrementally streamed OpenUI fences', () => {
    expect(extractOpenUIResponse('```openui\nroot = Card([])\n```')).toBe(
      'root = Card([])'
    )
    expect(extractOpenUIResponse('```openui\nroot = Card(')).toBe(
      'root = Card('
    )
  })

  test('leaves ordinary markdown and other code fences untouched', () => {
    expect(extractOpenUIResponse('```tsx\n<div />\n```')).toBeNull()
    expect(
      extractOpenUIResponse('Here is the answer:\n```openui\nCard()')
    ).toBeNull()
  })

  test('keeps interactive response state hidden in chat display and available to the model', () => {
    const request = appendOpenUIContext('Update this itinerary', {
      routeRemoved: { value: ['stop-1'] },
      submittedForm: { pace: 'relaxed' }
    })

    expect(stripOpenUIContext(request)).toBe('Update this itinerary')
    expect(describeOpenUIContext(request)).toContain('"stop-1"')
    expect(describeOpenUIContext(request)).toContain('"relaxed"')
  })
})
