import { describe, expect, it } from 'vitest'

import {
  emitCompleteText,
  emptyResponseText,
  shouldInjectEmptyFallback
} from '../empty-response'

/**
 * Guards the silent-empty case: the weak model sometimes answers with ONLY
 * fake <tool_call> XML, the sanitizer strips it all, and the turn ends with
 * zero text and zero error — a blank bubble with no Retry. The pipeline
 * must inject a continuation line instead. The product contract is
 * "NEVER an empty bubble": the injection applies even on aborted turns
 * when nothing was delivered yet.
 */
describe('empty response guard', () => {
  it('injects on every turn that delivered zero visible text', () => {
    expect(
      shouldInjectEmptyFallback({
        wroteContent: false,
        wroteToolPart: false,
        aborted: false
      })
    ).toBe(true)
    // Text delivered: never touch.
    expect(
      shouldInjectEmptyFallback({
        wroteContent: true,
        wroteToolPart: false,
        aborted: false
      })
    ).toBe(false)
    // Tool/image sections rendered but NO text: the model produced tool
    // output but no conversational answer — this IS an empty response for
    // connector turns (gmail read, drive, etc.) and needs the fallback.
    expect(
      shouldInjectEmptyFallback({
        wroteContent: false,
        wroteToolPart: true,
        aborted: false
      })
    ).toBe(true)
    // Aborted with nothing delivered: STILL inject — an aborted turn must
    // never leave a permanently blank bubble.
    expect(
      shouldInjectEmptyFallback({
        wroteContent: false,
        wroteToolPart: false,
        aborted: true
      })
    ).toBe(true)
    // Aborted after real text was delivered: keep the partial answer as-is.
    expect(
      shouldInjectEmptyFallback({
        wroteContent: true,
        wroteToolPart: false,
        aborted: true
      })
    ).toBe(false)
  })

  it('localizes the continuation line (never admits failure)', () => {
    expect(emptyResponseText('en')).toContain('answer right away')
    expect(emptyResponseText('fr')).toContain('je te réponds tout de suite')
    // Default (mg/unknown): French.
    expect(emptyResponseText('mg')).toContain('je te réponds tout de suite')
    expect(emptyResponseText(null)).toContain('je te réponds tout de suite')
    // Never mention failure or "could not answer".
    expect(emptyResponseText('fr')).not.toContain('Désolé')
    expect(emptyResponseText('en')).not.toContain('Sorry')
  })

  it('emits AI SDK compliant text parts with text-start, text-delta, and text-end', () => {
    const chunks: any[] = []
    const writer = {
      write: (chunk: unknown) => chunks.push(chunk)
    }

    emitCompleteText(writer, 'txt-test-1', 'Hello world')

    expect(chunks).toEqual([
      { type: 'text-start', id: 'txt-test-1' },
      { type: 'text-delta', id: 'txt-test-1', delta: 'Hello world' },
      { type: 'text-end', id: 'txt-test-1' }
    ])
  })
})

