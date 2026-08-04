import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the release-time e2e suite.
 *
 * The suite drives ONE real Obsidian (Electron) instance on a throwaway copy of
 * `e2e/fixtures/vault` — see `obsidianHarness.ts`. It is intentionally NOT part
 * of `npm test` (the vitest gate stays fast and hermetic); run it via
 * `npm run test:e2e`.
 */

/** Booting a desktop Electron app + vault index is slow; unit-test timeouts don't apply. */
const TEST_TIMEOUT_MS = 120_000;
/** metadataCache reindex after a write is async; expect-retries need headroom. */
const EXPECT_TIMEOUT_MS = 15_000;

export default defineConfig({
  testDir: '.',
  // Deliberately NOT `*.test.ts`: vitest owns that suffix, so the two runners
  // can never pick up each other's files.
  testMatch: '**/*.e2e.ts',
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  // One Obsidian instance, serial tests — parallel workers would fight over the
  // singleton app window and the throwaway vault/sandbox dirs, which are
  // process-wide and wiped on launch (see obsidianHarness.ts).
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: '../.tmp/e2e-artifacts',
});
