const OPENUI_FENCE = /^\s*```openui(?:-lang)?[ \t]*\r?\n([\s\S]*)$/i

export function extractOpenUIResponse(message: string): string | null {
  const match = OPENUI_FENCE.exec(message)
  if (!match) return null

  return match[1].replace(/\r?\n```[ \t]*\s*$/, '')
}
