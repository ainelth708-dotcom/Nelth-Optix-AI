import { sql } from 'drizzle-orm'

import { getPostgresDb } from '@/lib/db/postgres'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
  used: number
  enforced: boolean
}

function nextMidnightMillis(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime()
}

/**
 * Increment a daily rate-limit counter in PostgreSQL. The counter resets at
 * midnight UTC. Single atomic upsert (no transaction needed). Fail-open: on
 * any error we allow the request — identical contract to the old backend.
 */
export async function incrementRateLimit(
  key: string,
  limit: number
): Promise<RateLimitResult> {
  try {
    const db = getPostgresDb()
    const midnight = nextMidnightMillis()
    const rows = await db.execute<{ count: string }>(sql`
      insert into rate_limits (key, count, expires_at, updated_at)
      values (${key.slice(0, 200)}, 1, to_timestamp(${midnight} / 1000.0), now())
      on conflict (key) do update set
        count = case when rate_limits.expires_at > now() then rate_limits.count + 1 else 1 end,
        expires_at = case when rate_limits.expires_at > now() then rate_limits.expires_at else to_timestamp(${midnight} / 1000.0) end,
        updated_at = now()
      returning count`)
    const count = Number(rows[0]?.count ?? 1)
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: midnight,
      limit,
      used: count,
      enforced: true
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: 0,
      limit,
      used: 0,
      enforced: false
    }
  }
}

export function isEnforced(): boolean {
  return (
    process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true' &&
    Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)
  )
}
