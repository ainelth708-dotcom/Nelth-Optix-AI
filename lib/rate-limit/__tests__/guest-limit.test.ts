import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'

const mockIncrement = vi.fn()
const mockIsEnforced = vi.fn()

vi.mock('@/lib/rate-limit/store', () => ({
  incrementRateLimit: (...args: any[]) => mockIncrement(...args),
  isEnforced: (...args: any[]) => mockIsEnforced(...args)
}))

function setResult(used: number, allowed: boolean, limit: number) {
  mockIncrement.mockResolvedValue({
    allowed,
    remaining: allowed ? limit - used : 0,
    resetAt: 0,
    limit,
    used,
    enforced: true
  })
}

describe('checkAndEnforceGuestLimit', () => {
  beforeEach(() => {
    mockIncrement.mockReset()
    mockIsEnforced.mockReset()
    mockIsEnforced.mockReturnValue(true)
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
    delete process.env.GUEST_CHAT_DAILY_LIMIT
  })

  it('returns null when ip is missing', async () => {
    const response = await checkAndEnforceGuestLimit(null)
    expect(response).toBeNull()
  })

  it('returns 401 when over the default limit', async () => {
    setResult(11, false, 10)

    const response = await checkAndEnforceGuestLimit('1.2.3.4')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(401)
    const body = await response!.json()
    expect(body.error).toBe('Please sign in to continue.')
    expect(body.authRequired).toBe(true)
    expect(body.limit).toBe(10)
  })

  it('uses configured limit when set', async () => {
    process.env.GUEST_CHAT_DAILY_LIMIT = '5'
    setResult(6, false, 5)

    const response = await checkAndEnforceGuestLimit('5.6.7.8')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(401)
    const body = await response!.json()
    expect(body.limit).toBe(5)
  })

  it('allows request under the limit', async () => {
    setResult(3, true, 10)

    const response = await checkAndEnforceGuestLimit('9.9.9.9')
    expect(response).toBeNull()
  })
})
