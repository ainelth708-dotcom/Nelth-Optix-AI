import { describe, expect, it } from 'vitest'

import { createDocument, readDocument } from './document-runtime'
import { verifyDocumentSignature } from './document-signature'

/**
 * REAL file-signature (magic bytes) tests.
 *
 * Every rejection case uses genuinely wrong bytes (renamed/plain payloads) and
 * every acceptance case uses a REAL document produced by the engine. No fake
 * pass-through: a failure means the security gate genuinely does not work.
 */

describe('verifyDocumentSignature — real files are accepted', () => {
  it('accepts a real PDF produced by the engine', async () => {
    const buf = await createDocument('pdf', {
      title: 'Signature Gate',
      paragraphs: ['This PDF carries the real %PDF- signature.']
    })
    expect(verifyDocumentSignature('pdf', buf)).toEqual({ ok: true })
  })

  it('accepts a real DOCX package (PK zip signature)', async () => {
    const buf = await createDocument('docx', {
      title: 'Signature Gate',
      sections: [{ heading: 'Overview', paragraphs: ['Real OOXML package.'] }]
    })
    expect(verifyDocumentSignature('docx', buf)).toEqual({ ok: true })
  })

  it('accepts html / markdown (no binary signature expected)', () => {
    expect(verifyDocumentSignature('html', Buffer.from('<p>hi</p>'))).toEqual({
      ok: true
    })
    expect(
      verifyDocumentSignature('markdown', Buffer.from('# Hello'))
    ).toEqual({ ok: true })
  })
})

describe('verifyDocumentSignature — renamed / malformed payloads are rejected', () => {
  it('rejects a text file renamed to .pdf', () => {
    const fake = Buffer.from(
      'This is a plain text file that was renamed to .pdf by an attacker.'
    )
    const verdict = verifyDocumentSignature('pdf', fake)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/%PDF-/)
  })

  it('rejects content renamed to .docx / .xlsx / .pptx', () => {
    const fake = Buffer.from('plain ASCII masquerading as an office file...')
    for (const format of ['docx', 'xlsx', 'pptx'] as const) {
      const verdict = verifyDocumentSignature(format, fake)
      expect(verdict.ok, `format ${format} must be rejected`).toBe(false)
      expect(verdict.reason).toMatch(/PK zip signature/)
    }
  })

  it('rejects buffers that are too small to be documents', () => {
    expect(verifyDocumentSignature('xlsx', Buffer.from('PK')).ok).toBe(false)
    expect(verifyDocumentSignature('pdf', Buffer.from('%P')).ok).toBe(false)
  })
})

describe('readDocument / modifyDocument enforce the signature gate', () => {
  it('readDocument blocks a fake xlsx before any parser runs', async () => {
    const res = await readDocument(
      'xlsx',
      Buffer.from('definitely not a workbook at all')
    )
    expect(res.signatureBlocked).toBe(true)
    expect(res.error).toMatch(/Signature mismatch/)
    expect(res.text).toBe('')
  })

  it('readDocument blocks a fake PDF (renamed text) the same way', async () => {
    // Note: the payload must NOT contain the "%PDF-" substring anywhere,
    // including inside plain text, or it would legitimately pass the gate.
    const res = await readDocument(
      'pdf',
      Buffer.from('not a pdf at all, just random bytes with no marker inside')
    )
    expect(res.signatureBlocked).toBe(true)
  })

  it('readDocument still reads a REAL docx produced by the engine', async () => {
    const buf = await createDocument('docx', {
      title: 'Gate Positive',
      sections: [
        { heading: 'Overview', paragraphs: ['This text must be readable.'] }
      ]
    })
    const res = await readDocument('docx', buf)
    expect(res.signatureBlocked).toBeUndefined()
    expect(res.error).toBeUndefined()
    expect(res.text).toContain('This text must be readable.')
  })
})
