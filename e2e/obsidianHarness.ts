import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

/**
 * Launches a REAL Obsidian (Electron) on a throwaway copy of the fixture vault,
 * fully sandboxed from any system Obsidian install, with a test-only host plugin
 * that exposes this library (see e2e/fixtures/host-plugin).
 *
 * Connection: Obsidian is spawned with `--remote-debugging-port=0` and we attach
 * via `chromium.connectOverCDP` to the "DevTools listening on ws://…" endpoint
 * the app prints on stderr.
 * WHY-NOT Playwright's `_electron.launch`: it additionally needs the Electron
 * MAIN process's node inspector (`--inspect=0`), which Obsidian's packaged build
 * ignores (Electron fuses), so `_electron.launch` hangs until timeout — verified
 * against Obsidian 1.12.7. All our automation is renderer-level, so browser-level
 * CDP is sufficient.
 */

/** Must match e2e/fixtures/host-plugin/manifest.json. */
const HOST_PLUGIN_ID = 'obsidian-id-lib-e2e-host';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E_TMP_DIR = path.join(REPO_ROOT, '.tmp', 'e2e');
const VAULT_COPY_DIR = path.join(E2E_TMP_DIR, 'vault');
const SANDBOX_CONFIG_DIR = path.join(E2E_TMP_DIR, 'obsidian-config');
const FIXTURE_VAULT_DIR = path.join(REPO_ROOT, 'e2e', 'fixtures', 'vault');
const HOST_PLUGIN_BUILD_DIR = path.join(REPO_ROOT, '.tmp', 'host-plugin');

/** Fixed id for the sandbox `obsidian.json` vault entry (16 hex chars, like Obsidian's own). */
const E2E_VAULT_ID = '0e2e0e2e0e2e0e2e';

const LAUNCH_TIMEOUT_MS = 60_000;
/** Graceful-shutdown grace before SIGKILL. */
const FORCE_KILL_AFTER_MS = 10_000;
const WINDOW_POLL_INTERVAL_MS = 250;
/** App boot → `layoutReady` covers vault index + workspace restore. */
const WORKSPACE_READY_TIMEOUT_MS = 60_000;
const PLUGIN_READY_TIMEOUT_MS = 30_000;

export class ObsidianHarness {
  private constructor(
    private readonly browser: Browser,
    private readonly obsidianProcess: childProcess.ChildProcess,
    readonly page: Page,
  ) {
  }

  static async launch(): Promise<ObsidianHarness> {
    ObsidianHarness.prepareVaultCopy();
    ObsidianHarness.prepareSandboxConfigDir(VAULT_COPY_DIR);
    return ObsidianHarness.spawnAndConnect();
  }

  async close(): Promise<void> {
    // connectOverCDP's close() only disconnects; the app process must be ended
    // explicitly. finally: if the disconnect rejects, the process must still be
    // killed or it outlives the suite as a zombie.
    try {
      await this.browser.close();
    } finally {
      await ObsidianHarness.killAndWaitForExit(this.obsidianProcess);
    }
  }

  // --- library seam ---------------------------------------------------------
  //
  // THE one place that knows how the host plugin exposes the library, and the
  // one place that touches Obsidian's undocumented-but-stable `window.app`
  // globals — typed `any` here on purpose so there is a single place to fix
  // when they shift.

  /** Calls the library's write path against a real vault file. */
  async ensureDocId(vaultPath: string): Promise<string | null> {
    return this.page.evaluate(
      ({ pluginId, targetPath }) => {
        const app = (window as unknown as { app: any }).app;
        const file = app.vault.getAbstractFileByPath(targetPath);
        if (!file) {
          throw new Error(`e2e: vault file not found: path=[${targetPath}]`);
        }
        return app.plugins.plugins[pluginId].docIdService.ensureDocId(file);
      },
      { pluginId: HOST_PLUGIN_ID, targetPath: vaultPath },
    );
  }

  /** Read-only lookup — must NEVER mint an id. */
  async getDocId(vaultPath: string): Promise<string | null> {
    return this.page.evaluate(
      ({ pluginId, targetPath }) => {
        const app = (window as unknown as { app: any }).app;
        const file = app.vault.getAbstractFileByPath(targetPath);
        if (!file) {
          throw new Error(`e2e: vault file not found: path=[${targetPath}]`);
        }
        return app.plugins.plugins[pluginId].docIdService.getDocId(file);
      },
      { pluginId: HOST_PLUGIN_ID, targetPath: vaultPath },
    );
  }

  /** The file straight off disk — proves the bytes really landed. */
  readFileFromDisk(vaultPath: string): string {
    return fs.readFileSync(path.join(VAULT_COPY_DIR, vaultPath), 'utf8');
  }

  // --- launch internals -----------------------------------------------------

  /** Fails fast with an actionable message when the binary env var is absent. */
  private static resolveObsidianPath(): string {
    const obsidianPath = process.env['OBSIDIAN_PATH'];
    if (obsidianPath === undefined || obsidianPath === '') {
      throw new Error(
        'OBSIDIAN_PATH is not set. On Linux, `npm run test:e2e` sets it for you.\n'
        + "  macOS:   export OBSIDIAN_PATH='/Applications/Obsidian.app/Contents/MacOS/Obsidian'\n"
        + '  Windows: set OBSIDIAN_PATH to Obsidian.exe',
      );
    }
    if (!fs.existsSync(obsidianPath)) {
      throw new Error(`OBSIDIAN_PATH does not exist: obsidianPath=[${obsidianPath}]`);
    }
    return obsidianPath;
  }

  private static async spawnAndConnect(): Promise<ObsidianHarness> {
    const obsidianProcess = childProcess.spawn(ObsidianHarness.resolveObsidianPath(), [
      `--user-data-dir=${SANDBOX_CONFIG_DIR}`,
      // Port 0 = OS-assigned; the concrete endpoint is read from stderr.
      '--remote-debugging-port=0',
      // Electron's SUID chrome-sandbox is unavailable in most CI containers
      // (electron/electron#42510).
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      // Escape hatch for environment-specific Chromium flags (e.g.
      // `--ozone-platform=headless`). Space-separated only — no quoting.
      ...(process.env['OBSIDIAN_E2E_EXTRA_ARGS']?.split(' ').filter((arg) => arg !== '') ?? []),
    ]);
    try {
      const cdpEndpoint = await ObsidianHarness.waitForDevtoolsEndpoint(obsidianProcess);
      const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: LAUNCH_TIMEOUT_MS });
      const page = await ObsidianHarness.waitForObsidianWindow(browser);
      await ObsidianHarness.waitForWorkspaceReady(page);
      await ObsidianHarness.enableHostPlugin(page);
      return new ObsidianHarness(browser, obsidianProcess, page);
    } catch (error) {
      obsidianProcess.kill();
      throw error;
    }
  }

  /**
   * Kills Obsidian and WAITS for the process to actually exit. WHY: a dying
   * Obsidian still writes sandbox-config files on shutdown; returning before exit
   * lets those writes race the next launch — observed as `ENOTEMPTY` when the
   * next run wipes the config dir.
   */
  private static killAndWaitForExit(proc: childProcess.ChildProcess): Promise<void> {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const forceKillTimer = setTimeout(() => proc.kill('SIGKILL'), FORCE_KILL_AFTER_MS);
      proc.once('exit', () => {
        clearTimeout(forceKillTimer);
        resolve();
      });
      proc.kill();
    });
  }

  /**
   * Fresh copy of the fixture vault per run: tests stay idempotent and the
   * library's own writes (which MUTATE the files by design) never pollute the
   * source-controlled fixtures.
   */
  private static prepareVaultCopy(): void {
    if (!fs.existsSync(FIXTURE_VAULT_DIR)) {
      throw new Error(`Fixture vault missing: dir=[${FIXTURE_VAULT_DIR}]`);
    }
    if (!fs.existsSync(path.join(HOST_PLUGIN_BUILD_DIR, 'main.js'))) {
      throw new Error(
        `Host plugin bundle missing: dir=[${HOST_PLUGIN_BUILD_DIR}]. `
        + 'Run: node e2e/fixtures/host-plugin/build.mjs',
      );
    }
    fs.rmSync(VAULT_COPY_DIR, { recursive: true, force: true });
    fs.cpSync(FIXTURE_VAULT_DIR, VAULT_COPY_DIR, { recursive: true });

    // Install the freshly built host plugin into the COPY, and list it in
    // community-plugins.json so Obsidian loads it.
    const pluginDir = path.join(VAULT_COPY_DIR, '.obsidian', 'plugins', HOST_PLUGIN_ID);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.cpSync(HOST_PLUGIN_BUILD_DIR, pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(VAULT_COPY_DIR, '.obsidian', 'community-plugins.json'),
      JSON.stringify([HOST_PLUGIN_ID]),
    );
  }

  private static prepareSandboxConfigDir(vaultDir: string): void {
    fs.rmSync(SANDBOX_CONFIG_DIR, { recursive: true, force: true });
    fs.mkdirSync(SANDBOX_CONFIG_DIR, { recursive: true });
    // `open: true` boots straight into the vault (no vault picker);
    // `updateDisabled: true` stops auto-update traffic.
    const obsidianJson = {
      updateDisabled: true,
      vaults: { [E2E_VAULT_ID]: { path: vaultDir, ts: Date.now(), open: true } },
    };
    fs.writeFileSync(path.join(SANDBOX_CONFIG_DIR, 'obsidian.json'), JSON.stringify(obsidianJson));
  }

  /** Resolves the "DevTools listening on ws://…" endpoint from the app's stderr. */
  private static waitForDevtoolsEndpoint(proc: childProcess.ChildProcess): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let stderrSoFar = '';
      const timer = setTimeout(() => {
        reject(new Error(`Obsidian never announced a DevTools endpoint. stderr so far:\n${stderrSoFar}`));
      }, LAUNCH_TIMEOUT_MS);
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrSoFar += chunk.toString();
        const match = stderrSoFar.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match?.[1] !== undefined) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Obsidian exited before CDP was available: code=[${code}]\n${stderrSoFar}`));
      });
      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /** Waits for the vault window (`app://obsidian.md/...`) among the CDP-visible pages. */
  private static async waitForObsidianWindow(browser: Browser): Promise<Page> {
    const context = browser.contexts()[0];
    if (context === undefined) {
      throw new Error('CDP connected but Obsidian exposed no browser context');
    }
    const isVaultWindow = (page: Page): boolean => page.url().startsWith('app://obsidian.md');
    // State-poll (window creation AND its later navigation to app:// both count)
    // — CDP has no single event covering both. Bounded and condition-based, not
    // a race-masking sleep.
    const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const vaultWindow = context.pages().find(isVaultWindow);
      if (vaultWindow !== undefined) {
        return vaultWindow;
      }
      await new Promise((resolveTick) => setTimeout(resolveTick, WINDOW_POLL_INTERVAL_MS));
    }
    throw new Error(
      `No Obsidian vault window appeared. pages=[${context.pages().map((page) => page.url()).join(', ')}]`,
    );
  }

  private static async waitForWorkspaceReady(page: Page): Promise<void> {
    await page.waitForFunction(
      () => (window as unknown as { app?: any }).app?.workspace?.layoutReady === true,
      undefined,
      { timeout: WORKSPACE_READY_TIMEOUT_MS },
    );
  }

  private static async enableHostPlugin(page: Page): Promise<void> {
    // A fresh sandbox shows first-boot modals (vault trust / release notes).
    // Escape dismisses them; enablement below does not depend on the modal's
    // buttons, so this is best-effort cleanup, not a wait.
    await page.keyboard.press('Escape');
    await page.evaluate(async (pluginId) => {
      const app = (window as unknown as { app: any }).app;
      // setEnable(true) = the "Turn on community plugins" switch. It is
      // UNAVOIDABLE: the flag lives in localStorage inside the USER-DATA dir,
      // i.e. our throwaway sandbox, so a fresh sandbox always boots with
      // plugins off and nothing loads at all.
      await app.plugins.setEnable(true);
      await app.plugins.enablePlugin(pluginId);
    }, HOST_PLUGIN_ID);
    await page.waitForFunction(
      (pluginId) => Boolean((window as unknown as { app: any }).app.plugins.plugins[pluginId]),
      HOST_PLUGIN_ID,
      { timeout: PLUGIN_READY_TIMEOUT_MS },
    );
  }
}
