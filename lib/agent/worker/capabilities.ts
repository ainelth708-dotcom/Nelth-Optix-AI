// Single source of truth for agent capabilities.
//
// Everything (UI, runtime, APIs) reads capabilities from here — never
// hardcoded. Without a configured worker endpoint, execution
// capabilities report false and the UI shows UNAVAILABLE instead of
// pretending. Heartbeat/scheduling report active ONLY when an external
// scheduler is actually wired (AGENT_SCHEDULER_CONFIGURED=true).
import type { AgentCapabilities, WorkerCapabilityName } from './types'

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export function getCapabilities(): AgentCapabilities {
  const endpoint = process.env.WORKER_ENDPOINT?.trim() || null
  const advertised = new Set(parseList(process.env.WORKER_CAPABILITIES))
  const has = (name: WorkerCapabilityName): boolean =>
    endpoint !== null && advertised.has(name)
  // A Vercel Sandbox runtime (explicit opt-in) genuinely provides an
  // isolated shell even with no external worker endpoint configured.
  const sandboxShell = process.env.VERCEL_SANDBOX_ENABLED === 'true'
  const scheduler = process.env.AGENT_SCHEDULER_CONFIGURED === 'true'
  const persistentBrowser = has('browser') && scheduler
  return {
    browser: has('browser'),
    persistentBrowser,
    computer: has('computer'),
    shell: has('shell') || sandboxShell,
    proot: has('proot'),
    backgroundTasks: scheduler,
    scheduling: scheduler,
    heartbeatActive: scheduler,
    workerEndpoint: endpoint
  }
}

export function isCapable(
  capabilities: AgentCapabilities,
  name: WorkerCapabilityName
): boolean {
  return capabilities[name] === true
}
