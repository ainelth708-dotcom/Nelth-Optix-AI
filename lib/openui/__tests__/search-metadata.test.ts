import { describe, expect, test } from 'vitest'

import {
  appendOpenUISearchMetadata,
  splitOpenUISearchMetadata
} from '@/lib/openui/search-metadata'

const CALL_A = {
  query: 'Elon Musk latest news',
  results: [
    {
      url: 'https://example.com/a',
      title: 'Article A',
      content: 'Content A'
    }
  ],
  images: []
}

describe('appendOpenUISearchMetadata / splitOpenUISearchMetadata', () => {
  test('round-trips search metadata appended to an answer', () => {
    const answer = 'root = Col([Text("Hello")])'
    const combined = appendOpenUISearchMetadata(answer, { call_1: CALL_A })
    expect(combined.startsWith(answer)).toBe(true)

    const { content, metadata } = splitOpenUISearchMetadata(combined)
    expect(content).toBe(answer)
    expect(metadata).toEqual({ call_1: CALL_A })
  })

  test('leaves answers without metadata untouched', () => {
    expect(appendOpenUISearchMetadata('plain text', {})).toBe('plain text')
    expect(splitOpenUISearchMetadata('plain text')).toEqual({
      content: 'plain text',
      metadata: {}
    })
  })

  test('ignores a marker that is not at the end of the message', () => {
    const combined =
      appendOpenUISearchMetadata('root = Col([])', { call_1: CALL_A }) +
      '\nTrailing prose.'
    const { content, metadata } = splitOpenUISearchMetadata(combined)
    expect(content).toBe(combined)
    expect(metadata).toEqual({})
  })

  test('keeps visible content when the payload is truncated', () => {
    const { content, metadata } = splitOpenUISearchMetadata(
      'root = Col([])\n<!--nelth-search:%7Bbroken'
    )
    expect(content).toBe('root = Col([])')
    expect(metadata).toEqual({})
  })

  test('rejects a non-object payload', () => {
    expect(() =>
      splitOpenUISearchMetadata(
        'root = Col([])\n<!--nelth-search:' +
          encodeURIComponent(JSON.stringify(['not', 'an', 'object'])) +
          '-->'
      )
    ).toThrow()
  })

  test('rejects malformed search result payloads', () => {
    const malformed = 'root = Col([])\n<!--nelth-search:%7B%7D-->'
    expect(() => splitOpenUISearchMetadata(malformed)).toThrow(
      'invalid search result'
    )
  })
})
