import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { updatePermissions, recordAudit } from '@/lib/computer/store'

export async function POST(req: NextRequest) {
  try {
    const rawUserId = await getCurrentUserId()
    const userId = rawUserId || 'guest-session'

    const body = await req.json().catch(() => ({}))
    const { enabled, browser, files, shell } = body as {
      enabled?: boolean
      browser?: boolean
      files?: boolean
      shell?: boolean
    }

    const updated = updatePermissions(userId, {
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
      ...(typeof browser === 'boolean' ? { browser } : {}),
      ...(typeof files === 'boolean' ? { files } : {}),
      ...(typeof shell === 'boolean' ? { shell } : {})
    })

    recordAudit(
      userId,
      'permissions_update',
      'owner',
      'succeeded',
      `Permissions mises à jour : ${JSON.stringify(updated)}`
    )

    return NextResponse.json({ success: true, permissions: updated })
  } catch (error) {
    console.error('Error in POST /api/agent/computer/permissions:', error)
    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    )
  }
}
