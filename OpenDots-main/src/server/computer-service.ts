import {
  computerInputs,
  computerPermissionsSchema,
  type ComputerAction,
  type ComputerControl,
  type ComputerStatus,
} from '../shared/computer-types.js';
import type { WorkspaceStore } from './workspace.js';
import type { PlatformConfig } from './platform-config.js';
import {
  getBrowserForDot,
  getSandboxForDot,
} from './docker-free-computer.js';

export class ComputerService {
  private runningDots = new Set<string>();
  private controlHolders = new Map<string, 'bot' | 'human'>();

  constructor(
    private workspace: WorkspaceStore,
    private config: PlatformConfig,
    private paused: () => boolean,
    private transport: typeof fetch = fetch,
    private deadlineMs = 70000,
  ) {}

  /**
   * Always true: no Docker or external supervisor required!
   */
  get configured() {
    return true;
  }

  private requireDot(id: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id) || !this.workspace.dot(id))
      throw new Error('Dot not found.');
  }

  private allowed(
    id: string,
    kind: 'browser' | 'files' | 'shell' | undefined,
    actor: 'agent' | 'owner',
  ) {
    this.requireDot(id);
    const policy = this.workspace.computers.permissions(id);
    if (!policy.enabled || (kind && !policy[kind]))
      throw new Error('Computer permission is disabled.');
    if (actor === 'agent' && this.paused())
      throw new Error('Agents are paused.');
  }

  private async audited<T>(
    id: string,
    action: string,
    actor: 'owner' | 'agent',
    fn: () => Promise<T>,
  ): Promise<T> {
    this.requireDot(id);
    const receipt = this.workspace.computers.begin(id, action, actor);
    try {
      const result = await fn();
      this.workspace.computers.finish(receipt, 'succeeded');
      return result;
    } catch (error) {
      this.workspace.computers.finish(receipt, 'failed');
      throw error;
    }
  }

  async status(id: string): Promise<ComputerStatus> {
    this.requireDot(id);
    const permissions = this.workspace.computers.permissions(id);
    const isRunning = this.runningDots.has(id);
    const control: ComputerControl = {
      holder: this.controlHolders.get(id) || 'bot',
      requested: false,
      transitioning: false,
      resumeSnapshotRequired: false,
    };

    return {
      configured: true,
      state: isRunning ? 'running' : 'stopped',
      permissions,
      audit: this.workspace.computers.audit(id),
      control,
    };
  }

  async permissions(id: string, input: unknown) {
    const patch = computerPermissionsSchema.partial().parse(input);
    await this.audited(id, 'permissions', 'owner', async () =>
      this.workspace.computers.patch(id, patch),
    );
    return this.status(id);
  }

  async start(id: string) {
    await this.audited(id, 'start', 'owner', async () => {
      this.allowed(id, undefined, 'owner');
      const sandbox = await getSandboxForDot(id);
      await sandbox.init();
      this.runningDots.add(id);
    });
    return this.status(id);
  }

  async stop(id: string) {
    await this.audited(id, 'stop', 'owner', async () => {
      this.runningDots.delete(id);
      this.controlHolders.delete(id);
      const browser = getBrowserForDot(id);
      await browser.close().catch(() => null);
    });
    return this.status(id);
  }

  async control(id: string, verb: 'take' | 'release') {
    await this.audited(id, verb, 'owner', async () => {
      if (verb === 'take') {
        this.allowed(id, 'browser', 'owner');
        this.controlHolders.set(id, 'human');
      } else {
        this.controlHolders.set(id, 'bot');
      }
    });
    return this.status(id);
  }

  async action(
    id: string,
    action: ComputerAction,
    input: unknown,
    actor: 'owner' | 'agent' = 'owner',
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!Object.hasOwn(computerInputs, action))
      throw new Error('Unknown computer action.');
    const parsed = computerInputs[action].parse(input);

    return this.audited(id, action, actor, async () => {
      if (actor === 'agent' && action.startsWith('human_'))
        throw new Error('Human controls are owner-only.');

      const kind =
        action === 'exec'
          ? 'shell'
          : action.startsWith('files_')
            ? 'files'
            : 'browser';

      this.allowed(id, kind, actor);
      if (!this.runningDots.has(id)) {
        // Auto-start computer on first action if permissions enabled
        const sandbox = await getSandboxForDot(id);
        await sandbox.init();
        this.runningDots.add(id);
      }

      const browser = getBrowserForDot(id);
      const sandbox = await getSandboxForDot(id);

      switch (action) {
        case 'navigate': {
          const res = await browser.navigate((parsed as { url: string }).url);
          return res;
        }

        case 'read': {
          return await browser.read();
        }

        case 'snapshot': {
          return await browser.snapshot();
        }

        case 'screenshot': {
          return await browser.getScreen();
        }

        case 'click': {
          const { ref } = parsed as { ref: string; snapshotId: number };
          return await browser.click(ref);
        }

        case 'type': {
          const { ref, text, submit } = parsed as {
            ref: string;
            text: string;
            submit?: boolean;
          };
          return await browser.type(ref, text, submit);
        }

        case 'key': {
          const { key } = parsed as { key: string };
          return await browser.pressKey(key);
        }

        case 'scroll': {
          const { deltaY } = parsed as { deltaY: number };
          return await browser.scroll(deltaY);
        }

        case 'human_click': {
          const { x, y } = parsed as { x: number; y: number };
          return await browser.mouseClick(x, y);
        }

        case 'human_type': {
          const { text } = parsed as { text: string };
          return await browser.keyboardType(text);
        }

        case 'human_key': {
          const { key } = parsed as { key: string };
          return await browser.pressKey(key);
        }

        case 'human_scroll': {
          const { deltaY } = parsed as { deltaY: number };
          return await browser.scroll(deltaY);
        }

        case 'files_list': {
          const { path: dirPath } = parsed as { path: string };
          const files = await sandbox.listFiles(dirPath);
          return { path: dirPath || '.', files };
        }

        case 'files_read': {
          const { path: filePath } = parsed as { path: string };
          const content = await sandbox.readFile(filePath);
          return { path: filePath, text: content };
        }

        case 'files_write': {
          const { path: filePath, contents, append } = parsed as {
            path: string;
            contents: string;
            append?: boolean;
          };
          await sandbox.writeFile(filePath, contents, append);
          return { success: true, path: filePath };
        }

        case 'exec': {
          const { command, timeoutMs } = parsed as {
            command: string;
            timeoutMs?: number;
          };
          const res = await sandbox.runCommand(command, timeoutMs);
          return {
            stdout: res.stdout,
            stderr: res.stderr,
            exitCode: res.exitCode,
            durationMs: res.durationMs,
          };
        }

        default:
          throw new Error(`Unhandled computer action: ${action}`);
      }
    });
  }
}
