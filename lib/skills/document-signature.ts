import type { DocumentFormat } from './document-runtime'

/**
 * File-signature (magic bytes) verification for untrusted document inputs.
 *
 * The document tool accepts files from chat attachments (base64) and URLs, so a
 * payload renamed to `.docx` could otherwise reach the parsing libraries. This
 * gate compares the actual bytes against the real format signature:
 *
 *   - PDF            : `%PDF-` found within the first 1024 bytes (the PDF spec
 *                      permits a small junk header before the start marker).
 *   - DOCX/XLSX/PPTX : ZIP structure `PK` followed by 0x03 / 0x05 / 0x07
 *                      (standard / empty archived / spanned marker).
 *
 * Text formats (html/markdown) carry no binary signature — their integrity is
 * checked by their dedicated validation paths, not here.
 */

export interface SignatureVerdict {
  ok: boolean
  reason?: string
}

const ZIP_MAGIC_BYTES = new Set([0x03, 0x05, 0x07])

export function verifyDocumentSignature(
  format: DocumentFormat,
  buffer: Buffer
): SignatureVerdict {
  // Text formats carry no binary signature — nothing to verify here.
  if (format === 'html' || format === 'markdown') return { ok: true }

  if (!buffer || buffer.length < 8) {
    return { ok: false, reason: 'File is too small to be a valid document' }
  }

  const isZip =
    buffer[0] === 0x50 /* P */ &&
    buffer[1] === 0x4b /* K */ &&
    ZIP_MAGIC_BYTES.has(buffer[2])

  const isPdf = buffer.subarray(0, 1024).indexOf('%PDF-', 'latin1') !== -1

  switch (format) {
    case 'pdf':
      if (!isPdf) {
        return {
          ok: false,
          reason:
            'Signature mismatch: bytes do not contain %PDF- — the file may have been renamed or is malformed; refusing to process it'
        }
      }
      return { ok: true }
    case 'docx':
    case 'xlsx':
    case 'pptx':
      if (!isZip) {
        return {
          ok: false,
          reason:
            'Signature mismatch: not a real OOXML package (missing PK zip signature) — the file may have been renamed or is malformed; refusing to process it'
        }
      }
      return { ok: true }
    default:
      return { ok: true }
  }
}
