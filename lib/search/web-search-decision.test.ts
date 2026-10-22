import { describe, expect, it } from 'vitest'

import {
  buildWebSearchDecisionInput,
  parseWebSearchDecision,
  type WebSearchDecisionTurn
} from './web-search-decision'

describe('parseWebSearchDecision', () => {
  it('reads a plain JSON answer', () => {
    const decision = parseWebSearchDecision(
      '{"needsSearch": true, "query": "résultat ligue des champions"}'
    )
    expect(decision.needsSearch).toBe(true)
    expect(decision.query).toBe('résultat ligue des champions')
  })

  it('accepts the fenced and prose-wrapped shapes models emit', () => {
    const fenced = parseWebSearchDecision(
      '```json\n{"needsSearch": false, "query": ""}\n```'
    )
    expect(fenced.needsSearch).toBe(false)
    expect(fenced.query).toBe('')

    const wrapped = parseWebSearchDecision(
      'Decision: {"needsSearch": true, "query": "precio dolar hoy"} — done.'
    )
    expect(wrapped.needsSearch).toBe(true)
    expect(wrapped.query).toBe('precio dolar hoy')
  })

  it('stays false unless the flag is unambiguous', () => {
    expect(parseWebSearchDecision('{"needsSearch": "true"}').needsSearch).toBe(
      true
    )
    expect(
      parseWebSearchDecision('{"needsSearch": "maybe", "query": ""}')
        .needsSearch
    ).toBe(false)
    expect(
      parseWebSearchDecision('{"needsSearch": null, "query": "x"}').needsSearch
    ).toBe(false)
  })

  it('ignores a non-string query and trims a valid one', () => {
    expect(
      parseWebSearchDecision('{"needsSearch": true, "query": 42}').query
    ).toBe('')
    expect(
      parseWebSearchDecision(
        '{"needsSearch": true, "query": "  latest iphone price  "}'
      ).query
    ).toBe('latest iphone price')
  })

  it('throws when no JSON object is present', () => {
    expect(() => parseWebSearchDecision('I would search for that.')).toThrow(
      /no JSON object/
    )
    expect(() => parseWebSearchDecision('{"needsSearch" ')).toThrow()
  })
})

describe('buildWebSearchDecisionInput', () => {
  const turns: WebSearchDecisionTurn[] = [
    { role: 'user', text: 'Elon Musk ?' },
    { role: 'assistant', text: 'Il est PDG de Tesla et SpaceX.' },
    { role: 'system', text: 'note interne' },
    { role: 'tool', text: 'résultat' }
  ]

  it('lists recent turns with their role and marks the latest message', () => {
    const input = buildWebSearchDecisionInput('et lui ?', turns)
    expect(input).toBe(
      [
        'RECENT CONVERSATION (oldest first, most recent last):',
        'user: Elon Musk ?',
        'assistant: Il est PDG de Tesla et SpaceX.',
        'assistant: note interne',
        'user: résultat',
        '',
        'LATEST USER MESSAGE:',
        'et lui ?'
      ].join('\n')
    )
  })

  it('omits the context block when there is no history', () => {
    const input = buildWebSearchDecisionInput('What is TypeScript?')
    expect(input).toBe(
      ['LATEST USER MESSAGE:', 'What is TypeScript?'].join('\n')
    )
  })
})
