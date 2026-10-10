import { z } from 'zod'

export const computerPermissionsSchema = z
  .object({
    enabled: z.boolean().default(true),
    browser: z.boolean().default(true),
    files: z.boolean().default(true),
    shell: z.boolean().default(true)
  })
  .strict()

export type ComputerPermissions = z.infer<typeof computerPermissionsSchema>

export interface ComputerAudit {
  id: string
  action: string
  actor: 'owner' | 'agent'
  outcome: 'pending' | 'succeeded' | 'failed' | 'denied'
  details?: string
  createdAt: number
}

export interface ComputerApprovalRequest {
  id: string
  action: string
  tool: string
  input: Record<string, unknown>
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

export interface ComputerStatus {
  configured: boolean
  state: 'not_configured' | 'stopped' | 'running' | 'idle' | 'unavailable'
  permissions: ComputerPermissions
  audit: ComputerAudit[]
  currentUrl?: string
  pageTitle?: string
  lastScreenshot?: string
  activeSandboxId?: string
  pendingApprovals: ComputerApprovalRequest[]
  error?: string
}

export interface BrowserElementRef {
  ref: string
  tag: string
  text?: string
  role?: string
  selector?: string
  placeholder?: string
  ariaLabel?: string
  href?: string
}

export interface BrowserSnapshot {
  snapshotId: number
  url: string
  title: string
  elements: BrowserElementRef[]
  textSummary: string
  screenshot?: string
}

export const safeRelativePath = z
  .string()
  .max(1024)
  .refine(
    p =>
      !p.startsWith('/') &&
      !p.startsWith('\\') &&
      !p.includes('..') &&
      !p.includes('\0'),
    'Path must be a relative workspace path without traversal.'
  )

export const computerInputs = {
  navigate: z
    .object({
      url: z
        .string()
        .url()
        .max(2048)
        .describe('Full URL starting with http:// or https://')
    })
    .strict(),

  read: z
    .object({
      maxLength: z.number().int().positive().max(50000).optional().default(10000)
    })
    .strict(),

  snapshot: z
    .object({
      includeScreenshot: z.boolean().optional().default(true)
    })
    .strict(),

  screenshot: z
    .object({
      fullPage: z.boolean().optional().default(false)
    })
    .strict(),

  click: z
    .object({
      ref: z.string().min(1).describe('Interactive element ref tag from the snapshot (e.g. "btn-1", "link-2")'),
      snapshotId: z.number().int().nonnegative().optional()
    })
    .strict(),

  type: z
    .object({
      ref: z.string().min(1).describe('Interactive input/element ref from the snapshot'),
      text: z.string().max(16000).describe('Text to type into the field'),
      submit: z.boolean().optional().default(false).describe('Press enter after typing')
    })
    .strict(),

  key: z
    .object({
      key: z.string().min(1).max(100).describe('Key name to press (e.g. Enter, Tab, Escape, ArrowDown)')
    })
    .strict(),

  scroll: z
    .object({
      deltaY: z.number().finite().min(-10000).max(10000).describe('Vertical scroll distance in pixels')
    })
    .strict(),

  files_list: z
    .object({
      path: safeRelativePath.default('').describe('Directory path relative to workspace')
    })
    .strict(),

  files_read: z
    .object({
      path: safeRelativePath.describe('File path relative to workspace')
    })
    .strict(),

  files_write: z
    .object({
      path: safeRelativePath.describe('File path relative to workspace'),
      contents: z.string().max(250000).describe('Text contents to write to the file'),
      append: z.boolean().optional().default(false)
    })
    .strict(),

  exec: z
    .object({
      command: z.string().trim().min(1).max(4000).describe('Allowlisted shell command to run in the isolated sandbox'),
      timeoutMs: z.number().int().min(1000).max(60000).default(30000)
    })
    .strict()
}
