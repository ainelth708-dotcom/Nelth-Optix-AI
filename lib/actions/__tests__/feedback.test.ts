import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the PostgreSQL layer (per Firebase UID isolation is covered by
// lib/db/__tests__/chat-pg.test.ts against the real database).
vi.mock('@/lib/db/actions-pg', () => ({
  updateMessageFeedback: vi.fn(),
  getMessageFeedbackScore: vi.fn()
}))

import {
  getMessageFeedbackScore,
  updateMessageFeedback as updateMessageFeedbackPg
} from '@/lib/db/actions-pg'

import { getMessageFeedback, updateMessageFeedback } from '../feedback'

describe('Feedback Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateMessageFeedback', () => {
    it('should update message feedback successfully', async () => {
      vi.mocked(updateMessageFeedbackPg).mockResolvedValue(undefined)

      const result = await updateMessageFeedback('test-message-id', 1)

      expect(result).toEqual({ success: true })
      expect(updateMessageFeedbackPg).toHaveBeenCalledWith('test-message-id', 1)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(updateMessageFeedbackPg).mockRejectedValue(
        new Error('Database error')
      )

      const result = await updateMessageFeedback('test-message-id', -1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  describe('getMessageFeedback', () => {
    it('should retrieve feedback score successfully', async () => {
      vi.mocked(getMessageFeedbackScore).mockResolvedValue(1)

      const result = await getMessageFeedback('test-message-id')

      expect(result).toBe(1)
    })

    it('should return null when no feedback score exists', async () => {
      vi.mocked(getMessageFeedbackScore).mockResolvedValue(null)

      const result = await getMessageFeedback('test-message-id')

      expect(result).toBeNull()
    })

    it('should handle errors and return null', async () => {
      vi.mocked(getMessageFeedbackScore).mockRejectedValue(
        new Error('Database error')
      )

      const result = await getMessageFeedback('test-message-id')

      expect(result).toBeNull()
    })
  })
})
