// ---------------------------------------------------------------------------
// Nelth logo stamping (client-side, logo ONLY — no watermark removal or
// other processing): draws the result photo onto a canvas and overlays
// the Nelth mark (same artwork as the header IconLogo, filled white per
// the V3 spec) small bottom-right at 40% opacity with a soft shadow.
// Returns a PNG blob for a session blob URL.
// Throws on failure so callers can fall back to the raw URL.
// ---------------------------------------------------------------------------

import { NELTH_LOGO_PATH } from '@/components/ui/nelth-logo'

const LOGO_VIEWBOX_W = 497
const LOGO_VIEWBOX_H = 502
/** Long-edge cap (mobile Safari canvas limits + memory safety). */
const MAX_EDGE = 2048

function loadImage(
  src: string,
  crossOrigin?: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible.'))
    img.src = src
  })
}

export async function addNelthLogo(imageUrl: string): Promise<Blob> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    // Fetch as a blob first so CORS failures surface here — drawing a
    // cross-origin image directly would taint the canvas and silently
    // break toBlob below.
    const res = await fetch(imageUrl, { signal: controller.signal })
    if (!res.ok) throw new Error(`Image inaccessible (${res.status}).`)
    const srcBlob = await res.blob()
    const srcUrl = URL.createObjectURL(srcBlob)
    try {
      const photo = await loadImage(srcUrl)
      const scale = Math.min(
        1,
        MAX_EDGE / Math.max(photo.naturalWidth, photo.naturalHeight)
      )
      const w = Math.max(1, Math.round(photo.naturalWidth * scale))
      const h = Math.max(1, Math.round(photo.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponible.')
      ctx.drawImage(photo, 0, 0, w, h)
      // Logo: small filled-white mark (~10% of the image width) at 40%
      // opacity, bottom-right, 3% padding.
      const logoW = Math.max(20, Math.round(w * 0.1))
      const logoH = Math.round((logoW * LOGO_VIEWBOX_H) / LOGO_VIEWBOX_W)
      const pad = Math.round(Math.min(w, h) * 0.03)
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${logoW}" height="${logoH}" viewBox="0 0 ${LOGO_VIEWBOX_W} ${LOGO_VIEWBOX_H}">` +
        `<path d="${NELTH_LOGO_PATH}" fill="white" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</svg>`
      const svgUrl = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      )
      try {
        const logo = await loadImage(svgUrl)
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.35)'
        ctx.shadowBlur = Math.max(2, Math.round(logoW * 0.04))
        ctx.globalAlpha = 0.4
        ctx.drawImage(logo, w - logoW - pad, h - logoH - pad, logoW, logoH)
        ctx.restore()
      } finally {
        URL.revokeObjectURL(svgUrl)
      }
      const out = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!out) throw new Error('Encodage impossible.')
      return out
    } finally {
      URL.revokeObjectURL(srcUrl)
    }
  } finally {
    clearTimeout(timeout)
  }
}
