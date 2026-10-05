// Worker protocol types (provider-neutral).
//
// The agent runtime NEVER talks to a specific worker vendor here — only
// to these shapes. A real worker (browser / computer / shell host)
// receives jobs and emits events; without a configured worker endpoint
// nothing is simulated: capabilities report UNAVAILABLE instead.

export type WorkerCapabilityName = 'browser' | 'computer' | 'shell' | 'proot'

export type WorkerJobStatus =
  | 'CREATED'
  | 'DISPATCHED'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface WorkerJob {
  id: string
  taskId: string
  sessionId: string | null
  capability: WorkerCapabilityName
  action: string
  /** JSON-safe input for the action. Never secrets. */
  input: Record<string, unknown>
  riskClass: string
  riskTier: string
  status: WorkerJobStatus
  /** Null until a real worker endpoint accepts the job. */
  workerId: string | null
  timeoutMs: number
  createdAt: number
  updatedAt: number
}

export type WorkerEventType =
  | 'JOB_CREATED'
  | 'JOB_STARTED'
  | 'OBSERVING'
  | 'ACTION_STARTED'
  | 'ACTION_COMPLETED'
  | 'SCREENSHOT'
  | 'OUTPUT'
  | 'WAITING_APPROVAL'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'JOB_CANCELLED'

export interface WorkerEvent {
  /** Client-generated idempotency key (also the Firestore doc id). */
  eventId: string
  jobId: string
  taskId: string
  type: WorkerEventType
  /** Unix ms. Rejected when too far from server time (replay window). */
  at: number
  /** Small JSON-safe payload. Never passwords/cookies/tokens/secrets. */
  payload?: Record<string, unknown>
}

export interface AgentCapabilities {
  browser: boolean
  persistentBrowser: boolean
  computer: boolean
  shell: boolean
  proot: boolean
  backgroundTasks: boolean
  scheduling: boolean
  /** True only when an external scheduler actually calls heartbeat. */
  heartbeatActive: boolean
  /** Present when a real worker endpoint is configured, else null. */
  workerEndpoint: string | null
}

export type CapabilityStatus =
  | 'AVAILABLE'
  | 'RUNNING'
  | 'WAITING'
  | 'UNAVAILABLE'
  | 'FAILED'
