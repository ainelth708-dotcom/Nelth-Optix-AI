import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const execAsync = promisify(exec);

// SSRF prevention: block private endpoints and cloud metadata
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.169\.254$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

export function isUrlAllowed(urlStr: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { allowed: false, reason: 'Only http:// and https:// protocols are permitted.' };
    }
    const hostname = parsed.hostname.toLowerCase();
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return {
          allowed: false,
          reason: 'Access to local network or cloud metadata IP is blocked for security.',
        };
      }
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'Invalid URL.' };
  }
}

// Block destructive or dangerous shell patterns
const FORBIDDEN_SHELL_PATTERNS = [
  /rm\s+(-rf?|-fr?)\s+[/~]/i,
  /:()\{\s*:\|:&\s*\};:/, // fork bomb
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\/(sda|null|zero|random)/i,
  /chmod\s+777\s+\//i,
  /chown\s+.*\/etc/i,
  /curl.*\|\s*(bash|sh)/i,
  /wget.*\|\s*(bash|sh)/i,
  /env\b.*grep.*KEY/i,
  /\/etc\/(shadow|passwd)/i,
];

export function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Empty command.' };
  }
  for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'Dangerous command blocked by security guardrails.',
      };
    }
  }
  return { allowed: true };
}

export interface CommandExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface WorkspaceFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: number;
}

export interface ISandboxAdapter {
  init(): Promise<void>;
  runCommand(cmd: string, timeoutMs?: number): Promise<CommandExecResult>;
  listFiles(dirPath?: string): Promise<WorkspaceFileEntry[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, contents: string, append?: boolean): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Safe local isolated sandbox directory scoped per dot.
 */
class LocalSandboxAdapter implements ISandboxAdapter {
  private workspaceDir: string;

  constructor(private dotId: string) {
    this.workspaceDir = path.resolve(process.cwd(), '.local-sandboxes', dotId);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.workspaceDir, { recursive: true });
  }

  private resolveSafePath(relPath: string): string {
    const clean = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolved = path.resolve(this.workspaceDir, clean);
    if (!resolved.startsWith(this.workspaceDir)) {
      throw new Error('Access denied: Path traversal outside workspace.');
    }
    return resolved;
  }

  async runCommand(cmd: string, timeoutMs = 30000): Promise<CommandExecResult> {
    const allowedCheck = isCommandAllowed(cmd);
    if (!allowedCheck.allowed) {
      throw new Error(allowedCheck.reason || 'Command not permitted.');
    }
    const started = Date.now();
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.workspaceDir,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          WORKSPACE_DIR: this.workspaceDir,
        },
      });
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        durationMs: Date.now() - started,
      };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: e.stdout ? e.stdout.trim() : '',
        stderr: e.stderr ? e.stderr.trim() : e.message || 'Execution error',
        exitCode: typeof e.code === 'number' ? e.code : 1,
        durationMs: Date.now() - started,
      };
    }
  }

  async listFiles(dirPath = ''): Promise<WorkspaceFileEntry[]> {
    const targetDir = this.resolveSafePath(dirPath);
    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const results: WorkspaceFileEntry[] = [];
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = path.join(targetDir, entry.name);
        const rel = path.relative(this.workspaceDir, full).replace(/\\/g, '/');
        const stat = await fs.stat(full).catch(() => null);
        results.push({
          name: entry.name,
          path: rel,
          isDirectory: entry.isDirectory(),
          size: stat?.size,
          updatedAt: stat?.mtimeMs,
        });
      }
      return results;
    } catch {
      return [];
    }
  }

  async readFile(filePath: string): Promise<string> {
    const safe = this.resolveSafePath(filePath);
    return await fs.readFile(safe, 'utf-8');
  }

  async writeFile(filePath: string, contents: string, append = false): Promise<void> {
    const safe = this.resolveSafePath(filePath);
    await fs.mkdir(path.dirname(safe), { recursive: true });
    if (append) {
      await fs.appendFile(safe, contents, 'utf-8');
    } else {
      await fs.writeFile(safe, contents, 'utf-8');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const safe = this.resolveSafePath(filePath);
    await fs.rm(safe, { recursive: true, force: true });
  }

  async cleanup(): Promise<void> {
    // Keep user files intact across sessions
  }
}

/**
 * Production Vercel Sandbox adapter using `@vercel/sandbox`.
 */
class VercelSandboxAdapter implements ISandboxAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sandbox: any = null;

  constructor(private dotId: string) {}

  async init(): Promise<void> {
    const { Sandbox } = await import('@vercel/sandbox');
    this.sandbox = await Sandbox.create({
      timeout: 10 * 60 * 1000,
      resources: { vcpus: 1 },
      env: {
        DOT_ID: this.dotId,
        NODE_ENV: 'production',
      },
    });
  }

  async runCommand(cmd: string, timeoutMs = 30000): Promise<CommandExecResult> {
    if (!this.sandbox) throw new Error('Sandbox not initialized.');
    const allowedCheck = isCommandAllowed(cmd);
    if (!allowedCheck.allowed) {
      throw new Error(allowedCheck.reason || 'Command not permitted.');
    }
    const started = Date.now();
    const result = await this.sandbox.runCommand('bash', ['-c', cmd], {
      timeout: timeoutMs,
    });
    return {
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
      exitCode: result.exitCode ?? 0,
      durationMs: Date.now() - started,
    };
  }

  async listFiles(dirPath = ''): Promise<WorkspaceFileEntry[]> {
    if (!this.sandbox) return [];
    try {
      const files = await this.sandbox.files.list(dirPath || '.');
      return (files || []).map((f: { name: string; isDirectory?: boolean; size?: number }) => ({
        name: f.name,
        path: path.posix.join(dirPath || '', f.name),
        isDirectory: Boolean(f.isDirectory),
        size: f.size,
      }));
    } catch {
      return [];
    }
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.sandbox) throw new Error('Sandbox not initialized.');
    return await this.sandbox.files.read(filePath);
  }

  async writeFile(filePath: string, contents: string, append = false): Promise<void> {
    if (!this.sandbox) throw new Error('Sandbox not initialized.');
    if (append) {
      const existing = await this.readFile(filePath).catch(() => '');
      await this.sandbox.files.write(filePath, existing + contents);
    } else {
      await this.sandbox.files.write(filePath, contents);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.sandbox) return;
    await this.runCommand(`rm -rf "${filePath}"`);
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.stop();
      } catch {
        // ignore
      }
      this.sandbox = null;
    }
  }
}

const sandboxPool = new Map<string, ISandboxAdapter>();

export async function getSandboxForDot(dotId: string): Promise<ISandboxAdapter> {
  const existing = sandboxPool.get(dotId);
  if (existing) return existing;

  let adapter: ISandboxAdapter;
  if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) {
    try {
      adapter = new VercelSandboxAdapter(dotId);
      await adapter.init();
      sandboxPool.set(dotId, adapter);
      return adapter;
    } catch {
      // fallback to local sandbox
    }
  }

  adapter = new LocalSandboxAdapter(dotId);
  await adapter.init();
  sandboxPool.set(dotId, adapter);
  return adapter;
}

export class PlaywrightBrowserAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private snapshotCounter = 0;

  constructor(public readonly dotId: string) {}

  private async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1280,800',
        ],
      });
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OpenDotsComputer/1.0',
      });
    }

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(20000);
    return this.page;
  }

  async navigate(url: string) {
    const allowedCheck = isUrlAllowed(url);
    if (!allowedCheck.allowed) {
      throw new Error(allowedCheck.reason || 'URL not permitted.');
    }

    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1000);

    const title = await page.title().catch(() => '');
    const currentUrl = page.url();

    return {
      url: currentUrl,
      title,
    };
  }

  async read(maxLength = 10000) {
    const page = await this.ensurePage();
    const title = await page.title().catch(() => '');
    const url = page.url();

    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      const removeElements = clone.querySelectorAll('script, style, noscript, svg');
      removeElements.forEach((el) => el.remove());
      return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
    });

    return {
      title,
      url,
      text: text.slice(0, maxLength),
    };
  }

  async snapshot() {
    const page = await this.ensurePage();
    this.snapshotCounter += 1;
    const snapshotId = this.snapshotCounter;
    const title = await page.title().catch(() => '');
    const url = page.url();

    const elements = await page.evaluate(() => {
      const results: Array<{
        ref: string;
        tag: string;
        text?: string;
        role?: string;
        placeholder?: string;
        ariaLabel?: string;
        href?: string;
      }> = [];
      const candidates = document.querySelectorAll(
        'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="checkbox"]',
      );

      let count = 0;
      candidates.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(el).display === 'none') return;

        count++;
        const ref = `el-${count}`;
        el.setAttribute('data-opendots-ref', ref);

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const tag = el.tagName.toLowerCase();
        const placeholder = el.getAttribute('placeholder') || undefined;
        const ariaLabel = el.getAttribute('aria-label') || undefined;
        const href = el.getAttribute('href') || undefined;
        const role = el.getAttribute('role') || undefined;

        results.push({
          ref,
          tag,
          text: text || undefined,
          role,
          placeholder,
          ariaLabel,
          href,
        });
      });

      return results.slice(0, 100);
    });

    const { text } = await this.read(4000);
    const screenshot = await this.takeScreenshot();

    return {
      snapshotId,
      url,
      title,
      elements,
      text,
      screenshot,
    };
  }

  async click(ref: string) {
    const page = await this.ensurePage();
    const selector = `[data-opendots-ref="${ref}"]`;
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element ref "${ref}" not found. Take a fresh computer_snapshot to update element refs.`);
    }

    await element.click({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const title = await page.title().catch(() => '');
    const url = page.url();

    return { success: true, url, title };
  }

  async type(ref: string, text: string, submit = false) {
    const page = await this.ensurePage();
    const selector = `[data-opendots-ref="${ref}"]`;
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element ref "${ref}" not found. Take a fresh snapshot.`);
    }

    await element.fill(text, { timeout: 10000 });
    if (submit) {
      await element.press('Enter');
      await page.waitForTimeout(1000);
    }

    const title = await page.title().catch(() => '');
    const url = page.url();

    return { success: true, url, title };
  }

  async pressKey(key: string) {
    const page = await this.ensurePage();
    await page.keyboard.press(key);
    await page.waitForTimeout(500);

    const title = await page.title().catch(() => '');
    const url = page.url();

    return { success: true, url, title };
  }

  async scroll(deltaY: number) {
    const page = await this.ensurePage();
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(500);

    const title = await page.title().catch(() => '');
    const url = page.url();

    return { success: true, url, title };
  }

  async mouseClick(x: number, y: number) {
    const page = await this.ensurePage();
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
    return { success: true, x, y };
  }

  async keyboardType(text: string) {
    const page = await this.ensurePage();
    await page.keyboard.type(text);
    return { success: true };
  }

  async takeScreenshot(): Promise<string> {
    const page = await this.ensurePage();
    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: 80,
    });
    // Return pure base64 without prefix for OpenDots Screen object
    return buffer.toString('base64');
  }

  async getScreen() {
    const page = await this.ensurePage();
    const base64 = await this.takeScreenshot();
    return {
      base64,
      width: 1280,
      height: 800,
      url: page.url(),
      capturedAt: Date.now(),
    };
  }

  async close() {
    if (this.page) {
      await this.page.close().catch(() => null);
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => null);
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => null);
      this.browser = null;
    }
  }
}

const browserPool = new Map<string, PlaywrightBrowserAdapter>();

export function getBrowserForDot(dotId: string): PlaywrightBrowserAdapter {
  let adapter = browserPool.get(dotId);
  if (!adapter) {
    adapter = new PlaywrightBrowserAdapter(dotId);
    browserPool.set(dotId, adapter);
  }
  return adapter;
}
