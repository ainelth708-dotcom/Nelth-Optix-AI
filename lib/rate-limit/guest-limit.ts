import {
  incrementRateLimit,
  isEnforced
} from '@/lib/rate-limit/store'

const DEFAULT_GUEST_DAILY_LIMIT = 10

function getGuestDailyLimit(): number {
  const raw = process.env.GUEST_CHAT_DAILY_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_GUEST_DAILY_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_GUEST_DAILY_LIMIT
  }
  return Math.floor(parsed)
}

async function checkGuestLimit(ip: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}> {
  if (!isEnforced()) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit: 0 }
  }

  const limit = getGuestDailyLimit()
  const dateKey = new Date().toISOString().split('T')[0]
  const key = `rl:guest:chat:${ip}:${dateKey}`

  return incrementRateLimit(key, limit)
}

export async function checkAndEnforceGuestLimit(
  ip: string | null
): Promise<Response | null> {
  if (!ip) return null

  const result = await checkGuestLimit(ip)
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Please sign in to continue.',
        authRequired: true,
        remaining: 0,
        resetAt: result.resetAt,
        limit: result.limit
      }),
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt)
        }
      }
    )
  }

  return null
}
