import { describe, expect, it } from 'vitest'

import { signWorkerEvent, verifyWorkerEvent } from './auth'
import { getCapabilities } from './capabilities'
import {
  agentStateForEvent,
  jobStatusForEvent,
  validateWorkerEvent
} from './events'

const SECRET = 'test-secret'

function signed(overrides: Record<string, unknown> = {}) {
  const base = {
    eventId: 'evt-1',
    jobId: 'job-1',
    taskId: 'task-1',
    type: 'JOB_STARTED',
    at: Date.now(),
    payload: {}
  }
  const event = { ...base, ...overrides }
  const signature = signWorkerEvent({
    secret: SECRET,
    at: event.at as number,
    jobId: event.jobId as string,
    eventId: event.eventId as string,
    type: event.type as string
  })
  return { event, signature }
}

describe('worker callback auth', () => {
  it('accepts a fresh valid signature', () => {
    const { event, signature } = signed()
    expect(
      verifyWorkerEvent({
        secret: SECRET,
        signature,
        at: event.at as number,
        jobId: event.jobId as string,
        eventId: event.eventId as string,
        type: event.type as string
      })
    ).toEqual({ ok: true })
  })

  it('rejects bad signature, stale timestamps and missing secret', () => {
    const { event, signature } = signed()
    const base = {
      secret: SECRET,
      signature,
      at: event.at as number,
      jobId: event.jobId as string,
      eventId: event.eventId as string,
      type: event.type as string
    }
    expect(verifyWorkerEvent({ ...base, signature: '00'.repeat(32) }).ok).toBe(
      false
    )
    expect(
      verifyWorkerEvent({ ...base, at: Date.now() - 10 * 60 * 1000 }).ok
    ).toBe(false)
    expect(verifyWorkerEvent({ ...base, secret: undefined }).ok).toBe(false)
  })
})

describe('worker event validation', () => {
  it('accepts a well-formed event', () => {
    const { event } = signed({ type: 'OUTPUT', payload: { text: 'hi' } })
    const result = validateWorkerEvent(event)
    expect(result.ok).toBe(true)
  })

  it('rejects malformed events with reasons', () => {
    expect(validateWorkerEvent(null).ok).toBe(false)
    expect(validateWorkerEvent({ ...signed().event, eventId: '' }).ok).toBe(
      false
    )
    expect(validateWorkerEvent({ ...signed().event, type: 'NOPE' }).ok).toBe(
      false
    )
    expect(validateWorkerEvent({ ...signed().event, at: 'yesterday' }).ok).toBe(
      false
    )
  })

  it('maps event types to job + agent states', () => {
    expect(jobStatusForEvent('JOB_STARTED')).toBe('RUNNING')
    expect(jobStatusForEvent('WAITING_APPROVAL')).toBe('WAITING_APPROVAL')
    expect(jobStatusForEvent('JOB_COMPLETED')).toBe('COMPLETED')
    expect(jobStatusForEvent('JOB_FAILED')).toBe('FAILED')
    expect(jobStatusForEvent('JOB_CANCELLED')).toBe('CANCELLED')
    expect(jobStatusForEvent('JOB_CREATED')).toBe(null)
    expect(agentStateForEvent('OUTPUT')).toBe('RUNNING')
    expect(agentStateForEvent('JOB_COMPLETED')).toBe('VERIFYING')
    expect(agentStateForEvent('JOB_CREATED')).toBe(null)
  })
})

describe('capabilities derivation', () => {
  const OLD = { ...process.env }
  const reset = () => {
    delete process.env.WORKER_ENDPOINT
    delete process.env.WORKER_CAPABILITIES
    delete process.env.AGENT_SCHEDULER_CONFIGURED
  }

  it('reports everything unavailable without configuration', () => {
    reset()
    const caps = getCapabilities()
    expect(caps.browser).toBe(false)
    expect(caps.shell).toBe(false)
    expect(caps.scheduling).toBe(false)
    expect(caps.heartbeatActive).toBe(false)
    expect(caps.workerEndpoint).toBe(null)
    Object.assign(process.env, OLD)
  })

  it('enables only advertised capabilities behind an endpoint', () => {
    reset()
    process.env.WORKER_ENDPOINT = 'https://worker.example'
    process.env.WORKER_CAPABILITIES = 'browser, shell'
    process.env.AGENT_SCHEDULER_CONFIGURED = 'true'
    const caps = getCapabilities()
    expect(caps.browser).toBe(true)
    expect(caps.shell).toBe(true)
    expect(caps.computer).toBe(false)
    expect(caps.proot).toBe(false)
    expect(caps.persistentBrowser).toBe(true)
    expect(caps.scheduling).toBe(true)
    expect(caps.heartbeatActive).toBe(true)
    Object.assign(process.env, OLD)
  })
})
