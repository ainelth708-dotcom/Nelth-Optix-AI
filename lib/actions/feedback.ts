'use server'

import {
  getMessageFeedbackScore,
  updateMessageFeedback as updateMessageFeedbackPg
} from '@/lib/db/actions-pg'

export async function updateMessageFeedback(
  messageId: string,
  score: number,
  _userId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateMessageFeedbackPg(messageId, score)
    return { success: true }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update feedback'
    }
  }
}

export async function getMessageFeedback(
  messageId: string,
  _userId: string | null = null
): Promise<number | null> {
  try {
    return await getMessageFeedbackScore(messageId)
  } catch (error) {
    console.error('Error getting message feedback:', error)
    return null
  }
}
