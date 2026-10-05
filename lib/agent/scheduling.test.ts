import { describe, expect, it } from 'vitest'

import {
  computeNextRun,
  nextCronRun,
  parseCron,
  validateScheduleInput
} from './scheduling'

describe('cron parsing', () => {
  it('accepts standard expressions', () => {
    expect(parseCron('0 9 * * *')).not.toBe(null)
    expect(parseCron('*/15 * * * *')).not.toBe(null)
    expect(parseCron('30 8 * * 1-5')).not.toBe(null)
  })

  it('rejects malformed expressions', () => {
    expect(parseCron('not a cron')).toBe(null)
    expect(parseCron('* * * *')).toBe(null)
    expect(parseCron('61 * * * *')).toBe(null)
    expect(parseCron('0 25 * * *')).toBe(null)
  })

  it('finds the next daily 9h run', () => {
    // Monday 2026-10-05 08:00 UTC → same day 09:00 UTC.
    const from = Date.UTC(2026, 9, 5, 8, 0, 0)
    expect(nextCronRun('0 9 * * *', from)).toBe(Date.UTC(2026, 9, 5, 9, 0, 0))
  })

  it('rolls over to the next day when passed', () => {
    const from = Date.UTC(2026, 9, 5, 10, 0, 0)
    expect(nextCronRun('0 9 * * *', from)).toBe(Date.UTC(2026, 9, 6, 9, 0, 0))
  })
})

describe('next-run computation', () => {
  it('handles one-time schedules', () => {
    const future = Date.now() + 3600000
    expect(
      computeNextRun({
        type: 'once',
        runAt: future,
        intervalHours: null,
        cron: null,
        lastRunAt: null
      })
    ).toBe(future)
    expect(
      computeNextRun({
        type: 'once',
        runAt: Date.now() - 1000,
        intervalHours: null,
        cron: null,
        lastRunAt: null
      })
    ).toBe(null)
  })

  it('handles interval schedules', () => {
    const now = Date.now()
    const next = computeNextRun(
      {
        type: 'interval',
        runAt: null,
        intervalHours: 5,
        cron: null,
        lastRunAt: null
      },
      now
    )
    expect(next).toBe(now + 5 * 3600 * 1000)
    expect(
      computeNextRun({
        type: 'interval',
        runAt: null,
        intervalHours: 0,
        cron: null,
        lastRunAt: null
      })
    ).toBe(null)
  })
})

describe('schedule validation', () => {
  it('accepts valid inputs per type', () => {
    expect(
      validateScheduleInput({
        title: 'T',
        goal: 'G',
        type: 'once',
        runAt: Date.now() + 60000
      }).ok
    ).toBe(true)
    expect(
      validateScheduleInput({
        title: 'T',
        goal: 'G',
        type: 'interval',
        intervalHours: 5
      }).ok
    ).toBe(true)
    expect(
      validateScheduleInput({
        title: 'T',
        goal: 'G',
        type: 'cron',
        cron: '0 9 * * *'
      }).ok
    ).toBe(true)
  })

  it('rejects invalid inputs', () => {
    expect(validateScheduleInput({ title: '', goal: 'G' }).ok).toBe(false)
    expect(
      validateScheduleInput({ title: 'T', goal: 'G', type: 'once', runAt: 1 })
        .ok
    ).toBe(false)
    expect(
      validateScheduleInput({
        title: 'T',
        goal: 'G',
        type: 'cron',
        cron: 'nope'
      }).ok
    ).toBe(false)
  })
})
