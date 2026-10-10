import { ComputerApprovalRequest, ComputerAudit, ComputerPermissions, ComputerStatus } from './types'

interface UserComputerSession {
  userId: string
  permissions: ComputerPermissions
  audit: ComputerAudit[]
  pendingApprovals: Map<string, ComputerApprovalRequest>
  currentUrl?: string
  pageTitle?: string
  lastScreenshot?: string
  lastTerminalOutput?: string
  lastTerminalExitCode?: number
}

const sessions = new Map<string, UserComputerSession>()

function getOrCreateSession(userId: string): UserComputerSession {
  let session = sessions.get(userId)
  if (!session) {
    session = {
      userId,
      permissions: {
        enabled: true,
        browser: true,
        files: true,
        shell: true
      },
      audit: [],
      pendingApprovals: new Map()
    }
    sessions.set(userId, session)
  }
  return session
}

export function getComputerStatus(userId: string): ComputerStatus {
  const session = getOrCreateSession(userId)
  return {
    configured: true,
    state: session.permissions.enabled ? 'running' : 'stopped',
    permissions: session.permissions,
    audit: session.audit.slice(-50), // keep latest 50 entries
    currentUrl: session.currentUrl,
    pageTitle: session.pageTitle,
    lastScreenshot: session.lastScreenshot,
    pendingApprovals: Array.from(session.pendingApprovals.values())
  }
}

export function updatePermissions(userId: string, partial: Partial<ComputerPermissions>): ComputerPermissions {
  const session = getOrCreateSession(userId)
  session.permissions = { ...session.permissions, ...partial }
  return session.permissions
}

export function recordAudit(
  userId: string,
  action: string,
  actor: 'owner' | 'agent',
  outcome: 'pending' | 'succeeded' | 'failed' | 'denied',
  details?: string
): ComputerAudit {
  const session = getOrCreateSession(userId)
  const entry: ComputerAudit = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    actor,
    outcome,
    details,
    createdAt: Date.now()
  }
  session.audit.push(entry)
  if (session.audit.length > 200) session.audit.shift()
  return entry
}

export function updateBrowserState(userId: string, url: string, title?: string, screenshot?: string): void {
  const session = getOrCreateSession(userId)
  session.currentUrl = url
  if (title) session.pageTitle = title
  if (screenshot) session.lastScreenshot = screenshot
}

export function updateTerminalState(userId: string, output: string, exitCode: number): void {
  const session = getOrCreateSession(userId)
  session.lastTerminalOutput = output
  session.lastTerminalExitCode = exitCode
}

export function getPendingApproval(userId: string, approvalId: string): ComputerApprovalRequest | undefined {
  const session = sessions.get(userId)
  return session?.pendingApprovals.get(approvalId)
}

export function createApprovalRequest(
  userId: string,
  action: string,
  tool: string,
  input: Record<string, unknown>,
  reason: string
): ComputerApprovalRequest {
  const session = getOrCreateSession(userId)
  const id = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const req: ComputerApprovalRequest = {
    id,
    action,
    tool,
    input,
    reason,
    status: 'pending',
    createdAt: Date.now()
  }
  session.pendingApprovals.set(id, req)
  recordAudit(userId, `${tool} (approbation requise)`, 'agent', 'pending', reason)
  return req
}

export function resolveApproval(userId: string, approvalId: string, approved: boolean): boolean {
  const session = getOrCreateSession(userId)
  const req = session.pendingApprovals.get(approvalId)
  if (!req) return false
  req.status = approved ? 'approved' : 'rejected'
  session.pendingApprovals.delete(approvalId)
  recordAudit(
    userId,
    req.tool,
    'owner',
    approved ? 'succeeded' : 'denied',
    approved ? 'Approuvé par l’utilisateur' : 'Refusé par l’utilisateur'
  )
  return true
}
