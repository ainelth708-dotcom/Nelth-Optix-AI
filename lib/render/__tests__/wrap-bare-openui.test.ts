import { describe, expect, test } from 'vitest'

import { splitOpenUIResponses } from '@/lib/openui/response'
import { wrapBareOpenUIBlocks } from '@/lib/render/wrap-bare-openui'

describe('wrapBareOpenUIBlocks', () => {
  test('wraps a bare OpenUI program in a fence and the renderer picks it up', () => {
    const input = [
      'Voici le comparatif.',
      '',
      'root = Card([header, table], [src1])',
      '',
      'header = CardHeader("Comparatif Free, Orange, SFR")',
      'table = Table([colOperator])',
      'colOperator = Col("Opérateur")',
      'src1 = { title: "Comparateur", sourceName: "Selectra", url: "https://example.com" }',
      '',
      'Bon choix !'
    ].join('\n')

    const result = wrapBareOpenUIBlocks(input)
    expect(result).toContain('```openui\nroot = Card(')
    expect(result).toMatch(/src1 = \{[^\n]*\}\n```/)

    // Prose stays outside the fence.
    expect(result.indexOf('Voici le comparatif.')).toBeLessThan(
      result.indexOf('```openui')
    )
    expect(result.indexOf('Bon choix !')).toBeGreaterThan(
      result.lastIndexOf('```')
    )

    // The wrapped program is rendered as an OpenUI segment, not raw text.
    const segments = splitOpenUIResponses(result)
    expect(segments.map(segment => segment.type)).toEqual([
      'markdown',
      'openui',
      'markdown'
    ])
    expect(segments[1]).toMatchObject({
      type: 'openui',
      content: expect.stringContaining('root = Card(')
    })
  })

  test('keeps an already fenced OpenUI program untouched', () => {
    const input = [
      'Here it is:',
      '',
      '```openui',
      'root = Card([header])',
      'header = CardHeader("Title")',
      '```'
    ].join('\n')
    expect(wrapBareOpenUIBlocks(input)).toBe(input)
  })

  test('follows multiline calls through bracket balance', () => {
    const input = [
      'root = Card([',
      '  header,',
      '  table], [src1])',
      'header = CardHeader("Title")',
      'table = Table([colA])',
      'src1 = { title: "A", sourceName: "B", url: "https://example.com" }',
      '',
      'Done.'
    ].join('\n')

    const result = wrapBareOpenUIBlocks(input)
    const fenceClose = result.indexOf('```', result.indexOf('```openui') + 1)
    // Everything up to (and including) the last assignment is inside the fence.
    expect(result.indexOf('src1 = {')).toBeLessThan(fenceClose)
    expect(result.indexOf('Done.')).toBeGreaterThan(fenceClose)
  })

  test('does not wrap assignment lines without the root entry point', () => {
    const input = 'card = Card(["a", "b"])\ntext = TextContent("hi")'
    expect(wrapBareOpenUIBlocks(input)).toBe(input)
  })

  test('does not touch prose that merely contains equals signs', () => {
    const input = [
      'La formule est simple :',
      '',
      'a = 1',
      'b = a + 1',
      'root = 0'
    ].join('\n')
    expect(wrapBareOpenUIBlocks(input)).toBe(input)
  })

  test('does not touch OpenUI-like text inside other code fences', () => {
    const input = [
      'Tutorial:',
      '',
      '```text',
      'root = Card(["example"])',
      '```'
    ].join('\n')
    expect(wrapBareOpenUIBlocks(input)).toBe(input)
  })

  test('does not merge a run with prose after a blank line', () => {
    const input = [
      'root = Card([header])',
      'header = CardHeader("Title")',
      '',
      'And some closing words.'
    ].join('\n')

    const result = wrapBareOpenUIBlocks(input)
    expect(result).toMatch(/header = CardHeader\("Title"\)\n```/)
    expect(result.indexOf('And some closing words.')).toBeGreaterThan(
      result.lastIndexOf('```')
    )
  })
})
