import type { Thread } from '@openuidev/react-ui'

export const OPENUI_CHAT_PREFIX = 'oiu_'
export const MAX_BODY_BYTES = 1_000_000

export type StoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  [key: string]: unknown
}

function textContent(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return null
  return value
    .flatMap(part =>
      part &&
      typeof part === 'object' &&
      'text' in part &&
      typeof part.text === 'string'
        ? [part.text]
        : []
    )
    .join('')
}

export function parseMessage(value: unknown): StoredMessage | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const content = textContent(candidate.content)
  if (
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    candidate.id.length > 191 ||
    (candidate.role !== 'user' && candidate.role !== 'assistant') ||
    content === null ||
    content.length > 200_000
  ) {
    return null
  }
  return {
    ...candidate,
    id: candidate.id,
    role: candidate.role,
    content
  } as StoredMessage
}

export function titleFromMessage(message: StoredMessage): string {
  return message.content.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New chat'
}

export function toThread(chat: {
  id: string
  title: string
  createdAt: Date
}): Thread {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt.toISOString()
  }
}
