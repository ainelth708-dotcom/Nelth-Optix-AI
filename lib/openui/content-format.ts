/**
 * Distinguishes OpenUI Lang programs (rendered by the OpenUI Renderer) from
 * plain Markdown text (rendered as classic prose).
 *
 * ChatGPT's Intelligent UI rule applied here: basic prompts keep the old
 * text-only format, and rich UI is generated only when visuals genuinely add
 * value. The model may therefore answer in either format, and the client
 * must route each response to the right renderer instead of forcing every
 * answer through the OpenUI Renderer.
 */
const OPENUI_FENCE_RE = /```openui(?:-lang)?\b/i
const OPENUI_ROOT_RE = /^\s*root\s*=/m

export function isOpenUILangResponse(content: string): boolean {
  const text = content.trim()
  if (!text) return false
  if (OPENUI_FENCE_RE.test(text)) return true
  return OPENUI_ROOT_RE.test(text)
}
