import { describe, expect, it } from 'vitest'

import { checkChromiumPremium } from './document-pdf-html'
import { detectRenderEngine } from './document-render-engine'

/**
 * REAL render-engine identification tests.
 *
 * Each verdict must come from genuine bytes produced by the corresponding
 * engine — never from configuration or hard-coded expectations.
 */

describe('detectRenderEngine — verdicts from real PDF bytes', () => {
  // Generous budget: the first dynamic import of pdf-lib on a slow disk can
  // exceed the default 20s test timeout (the module itself is small; the cost
  // is one-time disk cold load in the worker).
  it('identifies a genuine pdf-lib artifact as pdf-lib', { timeout: 90_000 }, async () => {
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    pdf.addPage([595, 842])
    const bytes = Buffer.from(await pdf.save())
    expect(await detectRenderEngine(bytes)).toBe('pdf-lib')
  })

  it('identifies the engine of a premium-created PDF (chromium when the browser works, pdf-lib when it fell back)', { timeout: 120_000 }, async () => {
    const { createDocument } = await import('./document-runtime')
    const available = await checkChromiumPremium()
    const buf = await createDocument('pdf', {
      premium: true,
      template: 'report',
      title: 'Engine Identification',
      paragraphs: ['This paragraph documents which engine rendered the file.']
    })
    const engine = await detectRenderEngine(buf)
    if (available) {
      // Real Chromium premium render — the producer must not be pdf-lib.
      expect(engine).toBe('chromium')
    } else {
      // Honest fallback: still a real PDF, engine truthfully identified.
      expect(engine).toBe('pdf-lib')
    }
  })

  it('returns unknown for non-PDF bytes instead of pretending', async () => {
    expect(await detectRenderEngine(Buffer.from('<html>not a pdf</html>'))).toBe(
      'unknown'
    )
  })
})
