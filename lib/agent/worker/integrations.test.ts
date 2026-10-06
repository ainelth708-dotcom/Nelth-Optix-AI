import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listAgentSkills, loadAgentSkill } from '../skills'

describe('agent skills bridge (real skills-main)', () => {
  it('discovers skills with id and description', async () => {
    const skills = await listAgentSkills()
    expect(skills.length).toBeGreaterThan(0)
    for (const s of skills.slice(0, 5)) {
      expect(typeof s.id).toBe('string')
      expect(s.id.length).toBeGreaterThan(0)
      expect(typeof s.description).toBe('string')
    }
  })

  it('loads a full SKILL.md body on demand', async () => {
    const skills = await listAgentSkills()
    const first = skills[0]
    if (!first) return
    const body = await loadAgentSkill(first.id)
    expect(body.trim().length).toBeGreaterThan(0)
  })

  it('rejects unknown skill ids', async () => {
    await expect(loadAgentSkill('no-such-skill-xyz')).rejects.toThrow(
      /Unknown skill/
    )
  })
})

const sandboxMocks = vi.hoisted(() => ({
  runCommand: vi.fn(),
  stop: vi.fn(),
  get: vi.fn(),
  create: vi.fn()
}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: sandboxMocks.get,
    create: sandboxMocks.create
  }
}))

// Imported AFTER the mock so it binds to the stub.
import { WorkerUnavailableError } from './adapter'
import type { WorkerJob } from './types'
import { VercelSandboxWorkerAdapter } from './vercel-sandbox'

function shellJob(overrides: Partial<WorkerJob> = {}): WorkerJob {
  return {
    id: 'job-sb-1',
    taskId: 'task-sb-1',
    sessionId: null,
    capability: 'shell',
    action: 'exec',
    input: { command: ['echo', 'hi'] },
    riskClass: 'SAFE',
    riskTier: 'NOTICE',
    status: 'CREATED',
    workerId: null,
    timeoutMs: 15000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

describe('VercelSandboxWorkerAdapter (mocked SDK)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sandboxMocks.get.mockRejectedValue(new Error('not-found'))
    sandboxMocks.create.mockResolvedValue({
      runCommand: sandboxMocks.runCommand,
      stop: sandboxMocks.stop
    })
    sandboxMocks.runCommand.mockResolvedValue({
      exitCode: 0,
      stdout: async () => 'hi\n',
      stderr: async () => ''
    })
  })

  it('rejects non-shell capabilities honestly', async () => {
    const adapter = new VercelSandboxWorkerAdapter()
    await expect(
      adapter.dispatch(shellJob({ capability: 'browser', action: 'navigate' }))
    ).rejects.toBeInstanceOf(WorkerUnavailableError)
    expect(sandboxMocks.create).not.toHaveBeenCalled()
  })

  it('requires a command array', async () => {
    const adapter = new VercelSandboxWorkerAdapter()
    await expect(adapter.dispatch(shellJob({ input: {} }))).rejects.toThrow(
      /command/
    )
  })

  it('creates (or resumes) a sandbox and runs the command', async () => {
    const adapter = new VercelSandboxWorkerAdapter()
    const result = await adapter.dispatch(shellJob(), { uid: 'user-1' })
    expect(result.accepted).toBe(true)
    expect(sandboxMocks.create).toHaveBeenCalledTimes(1)
    expect(sandboxMocks.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'echo', args: ['hi'] })
    )
  })

  it('stops the task sandbox on cancel', async () => {
    sandboxMocks.get.mockResolvedValue({ stop: sandboxMocks.stop })
    const adapter = new VercelSandboxWorkerAdapter()
    await adapter.cancel(shellJob())
    expect(sandboxMocks.stop).toHaveBeenCalledTimes(1)
  })
})
