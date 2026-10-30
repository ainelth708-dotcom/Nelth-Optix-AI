/**
 * Nelth Intelligent UI — Streaming Parser
 * Incrementally detects, extracts and parses ```nelth-ui or ```nup code blocks
 * during real-time token streaming.
 */

import { validateNelthUISpec } from './schema'
import type { NelthUISpec } from './types'

export type StreamSegment =
  | { type: 'markdown'; content: string }
  | { type: 'nelth-ui'; raw: string; spec: NelthUISpec | null; isComplete: boolean; error?: string }

const CODE_BLOCK_START_RE = /```(?:nelth-ui|nup)\s*\n?/i

/**
 * Attempts to close an unclosed JSON string by balancing quotes, braces and brackets.
 * Useful for partial streaming recovery.
 */
export function balancePartialJson(partial: string): string {
  let s = partial.trim()
  if (!s.startsWith('{')) return ''

  // Track quote escaping and open brackets
  let inString = false
  let isEscaped = false
  const stack: ('{' | '[')[] = []

  for (let i = 0; i < s.length; i++) {
    const char = s[i]
    if (isEscaped) {
      isEscaped = false
      continue
    }
    if (char === '\\') {
      isEscaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (char === '{') stack.push('{')
      else if (char === '[') stack.push('[')
      else if (char === '}') {
        if (stack.length && stack[stack.length - 1] === '{') stack.pop()
      } else if (char === ']') {
        if (stack.length && stack[stack.length - 1] === '[') stack.pop()
      }
    }
  }

  // If stuck inside a string, close the quote
  if (inString) {
    s += '"'
  }

  // Remove trailing comma if any
  s = s.replace(/,\s*$/, '')

  // Close open brackets in reverse order
  while (stack.length) {
    const top = stack.pop()
    if (top === '{') s += '}'
    else if (top === '[') s += ']'
  }

  return s
}

/**
 * Parses message text and splits it into markdown segments and Nelth UI segments.
 * Safe for both actively streaming text and completed responses.
 */
export function parseNelthUISegments(text: string): StreamSegment[] {
  if (!text) return [{ type: 'markdown', content: '' }]

  const segments: StreamSegment[] = []
  let remaining = text

  while (remaining.length > 0) {
    const match = remaining.match(CODE_BLOCK_START_RE)
    if (!match || match.index == null) {
      segments.push({ type: 'markdown', content: remaining })
      break
    }

    const before = remaining.slice(0, match.index)
    if (before) {
      segments.push({ type: 'markdown', content: before })
    }

    const blockStartIndex = match.index + match[0].length
    const blockContent = remaining.slice(blockStartIndex)
    const endMatchIndex = blockContent.indexOf('```')

    if (endMatchIndex !== -1) {
      // Completed block
      const rawJson = blockContent.slice(0, endMatchIndex).trim()
      remaining = blockContent.slice(endMatchIndex + 3)

      try {
        const parsed = JSON.parse(rawJson)
        const validRes = validateNelthUISpec(parsed)
        if (validRes.success) {
          segments.push({
            type: 'nelth-ui',
            raw: rawJson,
            spec: validRes.spec,
            isComplete: true
          })
        } else {
          // Validation failed — treat as fallback markdown
          segments.push({
            type: 'nelth-ui',
            raw: rawJson,
            spec: null,
            isComplete: true,
            error: validRes.error
          })
        }
      } catch (err) {
        segments.push({
          type: 'nelth-ui',
          raw: rawJson,
          spec: null,
          isComplete: true,
          error: err instanceof Error ? err.message : 'Invalid JSON'
        })
      }
    } else {
      // Actively streaming block (unclosed)
      const rawJson = blockContent.trim()
      remaining = ''

      // Attempt incremental repair
      let partialSpec: NelthUISpec | null = null
      if (rawJson.startsWith('{')) {
        try {
          const balanced = balancePartialJson(rawJson)
          const parsed = JSON.parse(balanced)
          const validRes = validateNelthUISpec(parsed)
          if (validRes.success) {
            partialSpec = validRes.spec
          }
        } catch {
          // Incomplete token stream — wait for more chunks
          partialSpec = null
        }
      }

      segments.push({
        type: 'nelth-ui',
        raw: rawJson,
        spec: partialSpec,
        isComplete: false
      })
    }
  }

  return segments
}

