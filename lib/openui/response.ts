const OPENUI_BLOCK =
  /(^|\n)[ \t]*```openui(?:-lang)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n```[ \t]*(?=\r?$|\n|$)|$(?![\s\S]*\S))/gim

export function extractOpenUIResponse(message: string): string | null {
  const match = /^\s*```openui(?:-lang)?[ \t]*\r?\n([\s\S]*)$/i.exec(message)
  if (!match) return null

  return match[1].replace(/\r?\n```[ \t]*\s*$/, '')
}

export type OpenUISegment =
  | { type: 'markdown'; content: string }
  | { type: 'openui'; content: string }

export function splitOpenUIResponses(message: string): OpenUISegment[] {
  const segments: OpenUISegment[] = []
  OPENUI_BLOCK.lastIndex = 0
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = OPENUI_BLOCK.exec(message)) !== null) {
    const start = match.index + match[1].length
    if (start > cursor) {
      segments.push({ type: 'markdown', content: message.slice(cursor, start) })
    }
    segments.push({ type: 'openui', content: match[2] })
    cursor = OPENUI_BLOCK.lastIndex
  }

  if (cursor < message.length) {
    segments.push({ type: 'markdown', content: message.slice(cursor) })
  }

  return segments
}
