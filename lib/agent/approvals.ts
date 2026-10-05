// ---------------------------------------------------------------------------
// Approval gate (RiskGate-style, serverless-compatible).
//
// Sensitive agent actions (delete, send, pay, outbound calls, device
// control…) must pass through here: the action waits in WAITING_APPROVAL
// until the user allows once / for the session / always, or denies.
// Default queue is in-memory (per server instance); swap
// createApprovalQueue's backing map for Postgres when cross-instance
// approvals are needed. Never expose secrets in requests.
// ---------------------------------------------------------------------------

export type ApprovalRiskClass =
  | 'SAFE'
  | 'INSTALL'
  | 'DESTRUCTIVE'
  | 'OUTBOUND'
  | 'REMOTE'
  | 'MONEY'

export type ApprovalRiskTier = 'NOTICE' | 'CONFIRM' | 'HIGHEST'

export type ApprovalDecision =
  | 'ALLOW_ONCE'
  | 'ALLOW_SESSION'
  | 'ALLOW_ALWAYS'
  | 'DENY'

export type ApprovalStatus = 'PENDING' | 'DECIDED' | 'EXPIRED'

export interface ApprovalRequest {
  id: string
  taskId: string | null
  tool: string
  summary: string
  riskClass: ApprovalRiskClass
  riskTier: ApprovalRiskTier
  status: ApprovalStatus
  decision: ApprovalDecision | null
  createdAt: number
  decidedAt: number | null
}

function newApprovalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `approval-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export interface ApprovalQueue {
  request(input: {
    taskId?: string | null
    tool: string
    summary: string
    riskClass: ApprovalRiskClass
    riskTier: ApprovalRiskTier
  }): ApprovalRequest
  decide(id: string, decision: ApprovalDecision): ApprovalRequest
  pending(): ApprovalRequest[]
  get(id: string): ApprovalRequest | null
}

/** SAFE/NOTICE actions never need to wait — everything else does. */
export function requiresApproval(
  riskClass: ApprovalRiskClass,
  riskTier: ApprovalRiskTier
): boolean {
  return !(riskClass === 'SAFE' && riskTier === 'NOTICE')
}

export function createApprovalQueue(): ApprovalQueue {
  const store = new Map<string, ApprovalRequest>()
  return {
    request(input) {
      const now = Date.now()
      const req: ApprovalRequest = {
        id: newApprovalId(),
        taskId: input.taskId ?? null,
        tool: input.tool,
        summary: input.summary.slice(0, 300),
        riskClass: input.riskClass,
        riskTier: input.riskTier,
        status: 'PENDING',
        decision: null,
        createdAt: now,
        decidedAt: null
      }
      store.set(req.id, req)
      return req
    },
    decide(id, decision) {
      const req = store.get(id)
      if (!req) throw new Error(`Unknown approval request: ${id}`)
      if (req.status !== 'PENDING') {
        throw new Error(`Approval request already decided: ${id}`)
      }
      const decided: ApprovalRequest = {
        ...req,
        status: 'DECIDED',
        decision,
        decidedAt: Date.now()
      }
      store.set(id, decided)
      return decided
    },
    pending() {
      return [...store.values()].filter(r => r.status === 'PENDING')
    },
    get(id) {
      return store.get(id) ?? null
    }
  }
}
