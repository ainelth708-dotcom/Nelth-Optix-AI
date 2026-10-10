import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { isCommandAllowed } from './security'

const execAsync = promisify(exec)

export interface CommandExecResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export interface WorkspaceFileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  updatedAt?: number
}

export interface ISandboxAdapter {
  init(): Promise<void>
  runCommand(cmd: string, timeoutMs?: number): Promise<CommandExecResult>
  listFiles(dirPath?: string): Promise<WorkspaceFileEntry[]>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, contents: string, append?: boolean): Promise<void>
  deleteFile(filePath: string): Promise<void>
  cleanup(): Promise<void>
}

/**
 * Local isolated directory fallback sandbox when Vercel OIDC token is not present.
 * Ensures the app works smoothly in local development and offline environments
 * within a safe user-scoped directory.
 */
class LocalSandboxAdapter implements ISandboxAdapter {
  private workspaceDir: string

  constructor(private userId: string) {
    this.workspaceDir = path.resolve(process.cwd(), '.local-sandboxes', userId)
  }

  async init(): Promise<void> {
    await fs.mkdir(this.workspaceDir, { recursive: true })
  }

  private resolveSafePath(relPath: string): string {
    const clean = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '')
    const resolved = path.resolve(this.workspaceDir, clean)
    if (!resolved.startsWith(this.workspaceDir)) {
      throw new Error('Access denied: Path traversal outside workspace.')
    }
    return resolved
  }

  async runCommand(cmd: string, timeoutMs = 30000): Promise<CommandExecResult> {
    const allowedCheck = isCommandAllowed(cmd)
    if (!allowedCheck.allowed) {
      throw new Error(allowedCheck.reason || 'Command not permitted.')
    }
    const started = Date.now()
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.workspaceDir,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          WORKSPACE_DIR: this.workspaceDir
        }
      })
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        durationMs: Date.now() - started
      }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number; message?: string }
      return {
        stdout: e.stdout ? e.stdout.trim() : '',
        stderr: e.stderr ? e.stderr.trim() : e.message || 'Execution error',
        exitCode: typeof e.code === 'number' ? e.code : 1,
        durationMs: Date.now() - started
      }
    }
  }

  async listFiles(dirPath = ''): Promise<WorkspaceFileEntry[]> {
    const targetDir = this.resolveSafePath(dirPath)
    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true })
      const results: WorkspaceFileEntry[] = []
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue
        const full = path.join(targetDir, entry.name)
        const rel = path.relative(this.workspaceDir, full).replace(/\\/g, '/')
        const stat = await fs.stat(full).catch(() => null)
        results.push({
          name: entry.name,
          path: rel,
          isDirectory: entry.isDirectory(),
          size: stat?.size,
          updatedAt: stat?.mtimeMs
        })
      }
      return results
    } catch {
      return []
    }
  }

  async readFile(filePath: string): Promise<string> {
    const safe = this.resolveSafePath(filePath)
    return await fs.readFile(safe, 'utf-8')
  }

  async writeFile(filePath: string, contents: string, append = false): Promise<void> {
    const safe = this.resolveSafePath(filePath)
    await fs.mkdir(path.dirname(safe), { recursive: true })
    if (append) {
      await fs.appendFile(safe, contents, 'utf-8')
    } else {
      await fs.writeFile(safe, contents, 'utf-8')
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const safe = this.resolveSafePath(filePath)
    await fs.rm(safe, { recursive: true, force: true })
  }

  async cleanup(): Promise<void> {
    // Keep user files intact across sessions as workspace persistence.
  }
}

/**
 * Production Vercel Sandbox adapter using `@vercel/sandbox`.
 */
class VercelSandboxAdapter implements ISandboxAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sandbox: any = null

  constructor(private userId: string) {}

  async init(): Promise<void> {
    try {
      const { Sandbox } = await import('@vercel/sandbox')
      this.sandbox = await Sandbox.create({
        timeout: 10 * 60 * 1000,
        resources: { vcpus: 1 },
        env: {
          USER_ID: this.userId,
          NODE_ENV: 'production'
        }
      })
    } catch (err) {
      console.warn('Vercel Sandbox create failed or unauthenticated, falling back:', err)
      throw err
    }
  }

  async runCommand(cmd: string, timeoutMs = 30000): Promise<CommandExecResult> {
    if (!this.sandbox) throw new Error('Sandbox not initialized.')
    const allowedCheck = isCommandAllowed(cmd)
    if (!allowedCheck.allowed) {
      throw new Error(allowedCheck.reason || 'Command not permitted.')
    }
    const started = Date.now()
    const result = await this.sandbox.runCommand('bash', ['-c', cmd], {
      timeout: timeoutMs
    })
    return {
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
      exitCode: result.exitCode ?? 0,
      durationMs: Date.now() - started
    }
  }

  async listFiles(dirPath = ''): Promise<WorkspaceFileEntry[]> {
    if (!this.sandbox) return []
    try {
      const files = await this.sandbox.files.list(dirPath || '.')
      return (files || []).map((f: { name: string; isDirectory?: boolean; size?: number }) => ({
        name: f.name,
        path: path.posix.join(dirPath || '', f.name),
        isDirectory: Boolean(f.isDirectory),
        size: f.size
      }))
    } catch {
      return []
    }
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.sandbox) throw new Error('Sandbox not initialized.')
    return await this.sandbox.files.read(filePath)
  }

  async writeFile(filePath: string, contents: string, append = false): Promise<void> {
    if (!this.sandbox) throw new Error('Sandbox not initialized.')
    if (append) {
      const existing = await this.readFile(filePath).catch(() => '')
      await this.sandbox.files.write(filePath, existing + contents)
    } else {
      await this.sandbox.files.write(filePath, contents)
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.sandbox) return
    await this.runCommand(`rm -rf "${filePath}"`)
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.stop()
      } catch {
        // ignore shutdown error
      }
      this.sandbox = null
    }
  }
}

// Memory pool of active user sandbox adapters
const sandboxPool = new Map<string, ISandboxAdapter>()

export async function getSandboxForUser(userId: string): Promise<ISandboxAdapter> {
  const existing = sandboxPool.get(userId)
  if (existing) return existing

  let adapter: ISandboxAdapter
  if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) {
    try {
      adapter = new VercelSandboxAdapter(userId)
      await adapter.init()
      sandboxPool.set(userId, adapter)
      return adapter
    } catch {
      // Fallback to local sandbox if Vercel Sandbox initialization is unavailable
    }
  }

  adapter = new LocalSandboxAdapter(userId)
  await adapter.init()
  sandboxPool.set(userId, adapter)
  return adapter
}
