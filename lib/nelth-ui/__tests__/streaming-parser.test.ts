import { describe, expect, it } from 'vitest'
import { parseNelthUISegments, balancePartialJson } from '../streaming-parser'

describe('Nelth UI Streaming Parser', () => {
  it('passes standard markdown through as markdown segment', () => {
    const text = 'Here is a normal answer with no UI block.'
    const segments = parseNelthUISegments(text)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('markdown')
    if (segments[0].type === 'markdown') {
      expect(segments[0].content).toBe(text)
    }
  })

  it('balances partial JSON objects correctly during streaming', () => {
    const incomplete = '{"version": "1.0", "root": {"id": "1", "component": "card", "props": {"title": "Hello'
    const balanced = balancePartialJson(incomplete)
    expect(balanced).toContain('"title": "Hello"')
    expect(balanced.endsWith('}}}')).toBe(true)
    expect(() => JSON.parse(balanced)).not.toThrow()
  })

  it('extracts a complete ```nelth-ui specification block between markdown paragraphs', () => {
    const text = `
Here is your requested comparison:

\`\`\`nelth-ui
{
  "version": "1.0",
  "root": {
    "id": "root",
    "component": "card",
    "props": { "title": "Top Models" },
    "children": [
      {
        "id": "t1",
        "component": "text",
        "props": { "text": "Detailed findings below." }
      }
    ]
  }
}
\`\`\`

Let me know if you would like more details.
`
    const segments = parseNelthUISegments(text)
    expect(segments).toHaveLength(3)
    expect(segments[0].type).toBe('markdown')
    if (segments[0].type === 'markdown') {
      expect(segments[0].content).toContain('Here is your requested comparison:')
    }
    expect(segments[1].type).toBe('nelth-ui')
    if (segments[1].type === 'nelth-ui') {
      expect(segments[1].isComplete).toBe(true)
      expect(segments[1].spec).not.toBeNull()
      expect(segments[1].spec?.root.component).toBe('card')
    }
    expect(segments[2].type).toBe('markdown')
    if (segments[2].type === 'markdown') {
      expect(segments[2].content).toContain('Let me know if you would like more details.')
    }
  })

  it('handles actively streaming unclosed ```nelth-ui blocks gracefully', () => {
    const text = `Intro text.\n\n\`\`\`nelth-ui\n{"version": "1.0", "root": {"id": "c1", "component": "badge", "props": {"text": "Active"}}`
    const segments = parseNelthUISegments(text)
    expect(segments).toHaveLength(2)
    expect(segments[1].type).toBe('nelth-ui')
    if (segments[1].type === 'nelth-ui') {
      expect(segments[1].isComplete).toBe(false)
      expect(segments[1].spec).not.toBeNull()
      expect(segments[1].spec?.root.component).toBe('badge')
    }
  })
})
