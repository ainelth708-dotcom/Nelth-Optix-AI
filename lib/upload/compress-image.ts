/**
 * Client-side image compressor for uploads.
 *
 * Phone photos (3-15 Mo) stall or blow past the serverless body limit on
 * slow mobile networks. This squeezes them to a small JPEG budget BEFORE
 * upload: downscale to a max dimension, then walk JPEG qualities down
 * until the output fits. Small files pass through untouched (keeps
 * transparency and original bytes). No canvas available (SSR/tests) →
 * original file, never a crash.
 */

export interface CompressOptions {
  /** Files at or under this size go through untouched. Default 900_000. */
  maxBytes?: number
  /** Long edge cap in px. Default 1600. */
  maxDimension?: number
  /** JPEG qualities tried high → low. Default [0.85, 0.7, 0.55, 0.45]. */
  qualities?: number[]
}

export interface CompressedImage {
  /** Raw base64 (no data-URL prefix). */
  base64: string
  mime: string
  originalBytes: number
  finalBytes: number
  width: number
  height: number
  /** False when the file went through untouched (or no canvas). */
  compressed: boolean
}

const DEFAULT_QUALITIES = [0.85, 0.7, 0.55, 0.45]

export function computeTargetSize(
  naturalWidth: number,
  naturalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  const scale =
    Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight)) || 1
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale))
  }
}

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Lecture impossible.'))
    reader.readAsDataURL(file)
  })
}

function decodeImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Lecture impossible.'))
    img.src = objectUrl
  })
}

export async function compressImageForUpload(
  file: File,
  opts: CompressOptions = {}
): Promise<CompressedImage> {
  const maxBytes = opts.maxBytes ?? 900_000
  const maxDimension = opts.maxDimension ?? 1600
  const qualities =
    opts.qualities && opts.qualities.length > 0
      ? opts.qualities
      : DEFAULT_QUALITIES

  if (file.size <= maxBytes) {
    const base64 = await readAsBase64(file)
    return {
      base64,
      mime: file.type || 'image/jpeg',
      originalBytes: file.size,
      finalBytes: file.size,
      width: 0,
      height: 0,
      compressed: false
    }
  }

  // Canvas check FIRST (before any decode): jsdom/SSR/exotic browsers
  // have no 2d context — fall back to the original file immediately.
  let probeCanvas: HTMLCanvasElement | null = null
  let probeCtx: CanvasRenderingContext2D | null = null
  try {
    probeCanvas = document.createElement('canvas')
    probeCtx = probeCanvas.getContext('2d')
  } catch {
    probeCtx = null
  }
  if (!probeCanvas || !probeCtx) {
    const base64 = await readAsBase64(file)
    return {
      base64,
      mime: file.type || 'image/jpeg',
      originalBytes: file.size,
      finalBytes: file.size,
      width: 0,
      height: 0,
      compressed: false
    }
  }

  // Single decode, then measure + draw from the same element.
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await decodeImage(objectUrl)
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('Lecture impossible.')
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // Lost the context between probe and use: send original.
      const base64 = await readAsBase64(file)
      return {
        base64,
        mime: file.type || 'image/jpeg',
        originalBytes: file.size,
        finalBytes: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        compressed: false
      }
    }

    const { width, height } = computeTargetSize(
      img.naturalWidth,
      img.naturalHeight,
      maxDimension
    )
    canvas.width = width
    canvas.height = height
    ctx.drawImage(img, 0, 0, width, height)

    let best: { base64: string; bytes: number } | null = null
    for (const q of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', q)
      const comma = dataUrl.indexOf(',')
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
      const bytes = Math.ceil((base64.length * 3) / 4)
      if (!best || bytes < best.bytes) best = { base64, bytes }
      if (bytes <= maxBytes) break
    }
    // best is always set (qualities non-empty) — fallback guards types.
    const chosen = best ?? { base64: '', bytes: file.size }
    return {
      base64: chosen.base64,
      mime: 'image/jpeg',
      originalBytes: file.size,
      finalBytes: chosen.bytes,
      width,
      height,
      compressed: true
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
