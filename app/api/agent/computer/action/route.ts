import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getBrowserForUser } from '@/lib/computer/browser-adapter'
import { getSandboxForUser } from '@/lib/computer/sandbox-adapter'
import {
  getComputerStatus,
  recordAudit,
  updateBrowserState,
  updateTerminalState
} from '@/lib/computer/store'
import { checkPermissions } from '@/lib/computer/security'

export async function POST(req: NextRequest) {
  try {
    const rawUserId = await getCurrentUserId()
    const userId = rawUserId || 'guest-session'

    const body = await req.json().catch(() => ({}))
    const { action, ...payload } = body as {
      action?: string
      [key: string]: unknown
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const status = getComputerStatus(userId)

    switch (action) {
      case 'navigate': {
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const url = String(payload.url || '').trim()
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

        const browser = getBrowserForUser(userId)
        const result = await browser.navigate(url)
        updateBrowserState(userId, result.url, result.title, result.screenshot)
        recordAudit(userId, 'navigate', 'owner', 'succeeded', `Navigation manuelle : ${url}`)
        return NextResponse.json(result)
      }

      case 'snapshot': {
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const browser = getBrowserForUser(userId)
        const snapshot = await browser.snapshot(true)
        updateBrowserState(userId, snapshot.url, snapshot.title, snapshot.screenshot)
        recordAudit(userId, 'snapshot', 'owner', 'succeeded', `Instantané manuel sur ${snapshot.url}`)
        return NextResponse.json(snapshot)
      }

      case 'screenshot': {
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const browser = getBrowserForUser(userId)
        const screenshot = await browser.takeScreenshot()
        const readInfo = await browser.read(50).catch(() => ({ url: '', title: '' }))
        updateBrowserState(userId, readInfo.url, readInfo.title, screenshot)
        recordAudit(userId, 'screenshot', 'owner', 'succeeded', 'Capture manuelle')
        return NextResponse.json({ screenshot, url: readInfo.url, title: readInfo.title })
      }

      case 'click': {
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const ref = String(payload.ref || '').trim()
        if (!ref) return NextResponse.json({ error: 'Element ref required' }, { status: 400 })

        const browser = getBrowserForUser(userId)
        const result = await browser.click(ref)
        updateBrowserState(userId, result.url, result.title, result.screenshot)
        recordAudit(userId, 'click', 'owner', 'succeeded', `Clic manuel sur ${ref}`)
        return NextResponse.json(result)
      }

      case 'type': {
        const perm = checkPermissions(status.permissions, 'browser')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const ref = String(payload.ref || '').trim()
        const text = String(payload.text || '')
        const submit = Boolean(payload.submit)
        if (!ref) return NextResponse.json({ error: 'Element ref required' }, { status: 400 })

        const browser = getBrowserForUser(userId)
        const result = await browser.type(ref, text, submit)
        updateBrowserState(userId, result.url, result.title, result.screenshot)
        recordAudit(userId, 'type', 'owner', 'succeeded', `Saisie manuelle dans ${ref}`)
        return NextResponse.json(result)
      }

      case 'files_list': {
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const dirPath = String(payload.path || '')
        const sandbox = await getSandboxForUser(userId)
        const files = await sandbox.listFiles(dirPath)
        return NextResponse.json({ files, path: dirPath })
      }

      case 'files_read': {
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const filePath = String(payload.path || '')
        if (!filePath) return NextResponse.json({ error: 'File path required' }, { status: 400 })

        const sandbox = await getSandboxForUser(userId)
        const contents = await sandbox.readFile(filePath)
        return NextResponse.json({ contents, path: filePath })
      }

      case 'files_write': {
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const filePath = String(payload.path || '')
        const contents = String(payload.contents || '')
        const append = Boolean(payload.append)
        if (!filePath) return NextResponse.json({ error: 'File path required' }, { status: 400 })

        const sandbox = await getSandboxForUser(userId)
        await sandbox.writeFile(filePath, contents, append)
        recordAudit(userId, 'files_write', 'owner', 'succeeded', `Fichier écrit : "${filePath}"`)
        return NextResponse.json({ success: true, path: filePath })
      }

      case 'files_delete': {
        const perm = checkPermissions(status.permissions, 'files')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const filePath = String(payload.path || '')
        if (!filePath) return NextResponse.json({ error: 'File path required' }, { status: 400 })

        const sandbox = await getSandboxForUser(userId)
        await sandbox.deleteFile(filePath)
        recordAudit(userId, 'files_delete', 'owner', 'succeeded', `Fichier supprimé : "${filePath}"`)
        return NextResponse.json({ success: true, path: filePath })
      }

      case 'exec': {
        const perm = checkPermissions(status.permissions, 'shell')
        if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

        const command = String(payload.command || '').trim()
        if (!command) return NextResponse.json({ error: 'Command required' }, { status: 400 })

        const sandbox = await getSandboxForUser(userId)
        const result = await sandbox.runCommand(command, 30000)
        updateTerminalState(userId, result.stdout || result.stderr, result.exitCode)
        recordAudit(
          userId,
          'exec',
          'owner',
          result.exitCode === 0 ? 'succeeded' : 'failed',
          `Commande manuelle : \`${command}\``
        )
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in POST /api/agent/computer/action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    )
  }
}
