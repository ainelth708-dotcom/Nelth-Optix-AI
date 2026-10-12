export const OPENUI_CONTEXT_MARKER = ']]>openui:context'

export function appendOpenUIContext(
  message: string,
  state: Record<string, unknown>
): string {
  return `${message}\n\n${OPENUI_CONTEXT_MARKER}\n${JSON.stringify([state])}`
}

export function stripOpenUIContext(message: string): string {
  const markerIndex = message.indexOf(OPENUI_CONTEXT_MARKER)
  return markerIndex < 0 ? message : message.slice(0, markerIndex).trimEnd()
}

export function describeOpenUIContext(message: string): string {
  const markerIndex = message.indexOf(OPENUI_CONTEXT_MARKER)
  if (markerIndex < 0) return message

  const visibleMessage = message.slice(0, markerIndex).trimEnd()
  const serializedState = message
    .slice(markerIndex + OPENUI_CONTEXT_MARKER.length)
    .trim()

  try {
    const state: unknown = JSON.parse(serializedState)
    return `${visibleMessage}\n\nOpenUI interaction state from the previous response: ${JSON.stringify(state)}`
  } catch (error) {
    console.error('Failed to parse OpenUI interaction state:', error)
    return visibleMessage
  }
}
