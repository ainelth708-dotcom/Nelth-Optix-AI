import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkAndEnforceAdaptiveLimit } from '@/lib/rate-limit/adaptive-limit'

const mockIncrement = vi.fn()
const mockIsEnforced = vi.fn()
const mockTrack = vi.fn()
const mockAfter = vi.fn()

// `after` throws outside a request scope, so stand in for the runtime and
// run the task inline. Keeping it a spy also lets us assert that delivery
// is handed to it rather than left floating.
vi.mock('next/server', () => ({
  after: (task: Promise<unknown>) => mockAfter(task)
}))

vi.mock('@/lib/rate-limit/store', () => ({
  incrementRateLimit: (...args: any[]) => mockIncrement(...args),
  isEnforced: (...args: any[]) => mockIsEnforced(...args)
}))

vi.mock('@/lib/analytics/dispatch', () => ({
  capture: (...args: unknown[]) => mockTrack(...args)
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

describe('checkAndEnforceAdaptiveLimit', () => {
  beforeEach(() => {
    mockIncrement.mockReset()
    mockIsEnforced.mockReset()
    mockIsEnforced.mockReturnValue(true)
    mockTrack.mockReset()
    mockTrack.mockResolvedValue(undefined)
    mockAfter.mockReset()
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
    delete process.env.ADAPTIVE_CHAT_DAILY_LIMIT
  })

  it('allows requests under the default limit', async () => {
    setResult(5, true, 30)

    const response = await checkAndEnforceAdaptiveLimit('user-1')
    expect(response).toBeNull()
  })

  it('returns 429 when the default 30/day limit is exceeded', async () => {
    setResult(31, false, 30)

    const response = await checkAndEnforceAdaptiveLimit('user-2')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.limit).toBe(30)
    expect(body.mode).toBe('adaptive')
    expect(body.remaining).toBe(0)
    expect(typeof body.error).toBe('string')
  })

  it('honors ADAPTIVE_CHAT_DAILY_LIMIT override', async () => {
    process.env.ADAPTIVE_CHAT_DAILY_LIMIT = '5'
    setResult(6, false, 5)

    const response = await checkAndEnforceAdaptiveLimit('user-3')
    expect(response?.status).toBe(429)
    const body = await response!.json()
    expect(body.limit).toBe(5)
  })

  it('allows the request when the counter fails (fail-open)', async () => {
    mockIncrement.mockRejectedValue(new Error('boom'))

    const response = await checkAndEnforceAdaptiveLimit('user-5')
    expect(response).toBeNull()
  })

  it('skips enforcement when not in cloud deployment', async () => {
    mockIsEnforced.mockReturnValue(false)
    setResult(9999, false, 30)

    const response = await checkAndEnforceAdaptiveLimit('user-6')
    expect(response).toBeNull()
  })

  it('emits an "allowed" analytics event when under the limit', async () => {
    setResult(7, true, 30)

    await checkAndEnforceAdaptiveLimit('user-7')

    await new Promise(resolve => setImmediate(resolve))

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith({
      event: 'adaptive_limit_check',
      distinctId: 'user-7',
      properties: {
        outcome: 'allowed',
        userId: 'user-7',
        used: 7,
        limit: 30
      }
    })
  })

  it('emits a "blocked" analytics event when over the limit', async () => {
    setResult(31, false, 30)

    await checkAndEnforceAdaptiveLimit('user-8')

    await new Promise(resolve => setImmediate(resolve))

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith({
      event: 'adaptive_limit_check',
      distinctId: 'user-8',
      properties: {
        outcome: 'blocked',
        userId: 'user-8',
        used: 31,
        limit: 30
      }
    })
  })

  it('hands blocked-event delivery to after so the 429 cannot cut it short', async () => {
    setResult(31, false, 30)

    const response = await checkAndEnforceAdaptiveLimit('user-9')

    expect(response?.status).toBe(429)
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockAfter.mock.calls[0][0]).toBeInstanceOf(Promise)
  })

  it('does not emit analytics when enforcement is unavailable', async () => {
    mockIncrement.mockRejectedValue(new Error('boom'))

    await checkAndEnforceAdaptiveLimit('user-9')

    await new Promise(resolve => setImmediate(resolve))

    expect(mockTrack).not.toHaveBeenCalled()
  })
})
