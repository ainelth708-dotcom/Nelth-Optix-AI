import { describe, expect, it } from 'vitest'

import {
  OPENUI_CHAT_PREFIX,
  parseMessage,
  titleFromMessage,
  toThread
} from '../persistence'

describe('OpenUI persistence helpers', () => {
  it('accepts user and assistant messages while preserving their state', () => {
    const message = {
      id: 'message-1',
      role: 'assistant',
      content: [{ type: 'text', text: 'A useful answer' }],
      state: { selectedStop: 'Louvre' }
    }

    expect(parseMessage(message)).toEqual({
      ...message,
      content: 'A useful answer'
    })
  })

  it('rejects invalid roles and oversized message content', () => {
    expect(
      parseMessage({ id: 'message-1', role: 'system', content: 'No' })
    ).toBeNull()
    expect(
      parseMessage({
        id: 'message-2',
        role: 'user',
        content: 'x'.repeat(200_001)
      })
    ).toBeNull()
  })

  it('creates concise titles and ISO-dated Nelth thread records', () => {
    const titleMessage = {
      id: 'message-1',
      role: 'user' as const,
      content: '  Plan   two days in Paris  '
    }
    const createdAt = new Date('2026-04-12T10:30:00.000Z')

    expect(OPENUI_CHAT_PREFIX).toBe('oiu_')
    expect(titleFromMessage(titleMessage)).toBe('Plan two days in Paris')
    expect(toThread({ id: 'oiu_chat-1', title: 'Paris', createdAt })).toEqual({
      id: 'oiu_chat-1',
      title: 'Paris',
      createdAt: '2026-04-12T10:30:00.000Z'
    })
  })
})
