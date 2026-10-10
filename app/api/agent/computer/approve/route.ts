import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  getPendingApproval,
  resolveApproval,
  recordAudit,
  updateTerminalState
} from '@/lib/computer/store'
import { getSandboxForUser } from '@/lib/computer/sandbox-adapter'

export async function POST(req: NextRequest) {
  try {
    const rawUserId = await getCurrentUserId()
    const userId = rawUserId || 'guest-session'

    const body = await req.json().catch(() => ({}))
    const { approvalId, approved } = body as {
      approvalId?: string
      approved?: boolean
    }

    if (!approvalId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approvalId and approved (boolean) are required' },
        { status: 400 }
      )
    }

    const pending = getPendingApproval(userId, approvalId)
    if (!pending) {
      return NextResponse.json(
        { error: 'Demande d’approbation introuvable ou déjà traitée' },
        { status: 404 }
      )
    }

    let executionResult: unknown = null

    if (approved) {
      // Execute the pending action
      if (pending.tool === 'computer_exec') {
        const cmd = pending.input.command as string
        const sandbox = await getSandboxForUser(userId)
        const result = await sandbox.runCommand(cmd, 30000)
        updateTerminalState(userId, result.stdout || result.stderr, result.exitCode)
        recordAudit(
          userId,
          'exec_approved',
          'owner',
          result.exitCode === 0 ? 'succeeded' : 'failed',
          `Exécuté après approbation : \`${cmd}\``
        )
        executionResult = result
      } else if (pending.tool === 'computer_files_write') {
        const filePath = pending.input.path as string
        const contents = (pending.input.contents as string) || ''
        const append = Boolean(pending.input.append)
        const sandbox = await getSandboxForUser(userId)
        await sandbox.writeFile(filePath, contents, append)
        recordAudit(
          userId,
          'files_write_approved',
          'owner',
          'succeeded',
          `Écrit après approbation : "${filePath}"`
        )
        executionResult = { success: true, path: filePath }
      }
    }

    resolveApproval(userId, approvalId, approved)

    return NextResponse.json({
      success: true,
      approved,
      executionResult
    })
  } catch (error) {
    console.error('Error in POST /api/agent/computer/approve:', error)
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}
