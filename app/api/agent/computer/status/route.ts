import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getComputerStatus } from '@/lib/computer/store'
import { getSandboxForUser } from '@/lib/computer/sandbox-adapter'

export async function GET(req: NextRequest) {
  try {
    const rawUserId = await getCurrentUserId()
    const userId = rawUserId || 'guest-session'

    const status = getComputerStatus(userId)
    const { searchParams } = new URL(req.url)
    const dirPath = searchParams.get('path') || ''

    let files: unknown[] = []
    try {
      const sandbox = await getSandboxForUser(userId)
      files = await sandbox.listFiles(dirPath)
    } catch (err) {
      console.warn('Failed to list workspace files for status:', err)
    }

    return NextResponse.json({
      status,
      files
    })
  } catch (error) {
    console.error('Error in GET /api/agent/computer/status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve computer status' },
      { status: 500 }
    )
  }
}
