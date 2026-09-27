/**
 * V3 prompt baking: the Nelth-imagen_V3 backend takes no variations or
 * aspect-ratio parameters, so the user's choices are written into the
 * prompt itself (e.g. "a cat (generate 2 variations, aspect ratio 16:9)").
 * Deterministic and instant — no extra model call.
 */
export function buildV3Prompt(
  prompt: string,
  variations: number,
  ratio: string
): string {
  const text = (prompt ?? '').trim()
  const bits: string[] = []
  if (Number.isInteger(variations) && variations > 1) {
    bits.push(`generate ${variations} variations`)
  }
  if (ratio && ratio.trim().length > 0) {
    bits.push(`aspect ratio ${ratio.trim()}`)
  }
  if (bits.length === 0) return text
  return `${text} (${bits.join(', ')})`
}
