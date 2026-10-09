import { after } from 'next/server'

import { trackChatLimitEvent } from '@/lib/analytics'
import {
  incrementRateLimit,
  isEnforced
} from '@/lib/rate-limit/store'
import { perfLog } from '@/lib/utils/perf-logging'

const DEFAULT_DAILY_CHAT_LIMIT = 100

function getDailyChatLimit(): number {
  const raw = process.env.OVERALL_CHAT_DAILY_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_DAILY_CHAT_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_CHAT_LIMIT
  }
  return Math.floor(parsed)
}

async function checkOverallChatLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
  /** Current daily usage count after the check (incl. this attempt) */
  used: number
  /** True when the check ran against Postgres (i.e. enforced) */
  enforced: boolean
}> {
  const limit = getDailyChatLimit()

  // If rate limiting is not enforced (not cloud or no Firebase Admin), allow.
  if (!isEnforced()) {
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: 0,
      limit,
      used: 0,
      enforced: false
    }
  }

  const dateKey = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const key = `rl:chat:${userId}:${dateKey}`

  return incrementRateLimit(key, limit)
}

/**
 * Check and enforce chat rate limit
 * Returns a 429 Response if limit is exceeded, null if allowed
 */
export async function checkAndEnforceOverallChatLimit(
  userId: string
): Promise<Response | null> {
  const result = await checkOverallChatLimit(userId)

  // Only emit analytics for real (Redis-backed) checks. Local dev / cloud
  // without Upstash returns enforced=false and we skip tracking to avoid
  // polluting the dashboard with no-op events.
  //
  // Hand the capture to `after` rather than letting it float: the blocked
  // path returns a 429 immediately, so an un-awaited PostHog flush can be
  // cut short when the serverless runtime freezes. Allowed requests go on
  // to a long-lived stream and would survive, which would bias the block
  // rate downward exactly where it matters.
  if (result.enforced) {
    after(
      trackChatLimitEvent({
        outcome: result.allowed ? 'allowed' : 'blocked',
        userId,
        used: result.used,
        limit: result.limit
      })
    )
  }

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Daily chat limit reached. Please try again tomorrow.',
        remaining: 0,
        resetAt: result.resetAt,
        limit: result.limit
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt)
        }
      }
    )
  }

  perfLog(`Chat usage: ${result.limit - result.remaining}/${result.limit}`)

  return null
}
