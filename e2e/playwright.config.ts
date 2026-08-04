import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Playwright config for the release-time e2e suite.
 *
 * The suite drives ONE real Obsidian (Electron) instance on a throwaway copy of
 * `e2e/fixtures/vault` — see `obsidianHarness.ts`. It is intentionally NOT part
 * of `npm test` (the vitest gate stays fast and hermetic); run it via
 * `npm run test:e2e`.
 *
 * Two projects, both driving the same harness:
 *
 * - `bdd`    — the e2e BDD tier: `features/e2e/*.feature` compiled by
 *              playwright-bdd into throwaway specs (see docs-internal/bdd-testing-strategy.md).
 * - `legacy` — the pre-BDD `*.e2e.ts` specs, which keep running as-is while
 *              their behaviour migrates.
 */

/**
 * The e2e feature files, ABSOLUTE: playwright-bdd resolves `features` against
 * this config's directory but validates `featuresRoot` against the CWD, so a
 * relative path cannot satisfy both.
 */
const E2E_FEATURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'features', 'e2e');

/**
 * Compiles the feature files into specs and returns the generated testDir.
 * Relative paths below are relative to THIS config's directory. The output
 * lives under .tmp/ (gitignored): generated specs are build output, never
 * source — editing them would bypass the human review of `features/`.
 */
const bddTestDir = defineBddConfig({
  features: `${E2E_FEATURES_DIR}/*.feature`,
  featuresRoot: E2E_FEATURES_DIR,
  steps: 'steps/*.ts',
  outputDir: '../.tmp/e2e-bdd',
  // A step with no definition must FAIL, never quietly skip its scenario —
  // otherwise a scenario can pass by not being implemented.
  missingSteps: 'fail-on-gen',
});

/** Booting a desktop Electron app + vault index is slow; unit-test timeouts don't apply. */
const TEST_TIMEOUT_MS = 120_000;
/** metadataCache reindex after a write is async; expect-retries need headroom. */
const EXPECT_TIMEOUT_MS = 15_000;

export default defineConfig({
  projects: [
    { name: 'bdd', testDir: bddTestDir },
    {
      name: 'legacy',
      testDir: '.',
      // Deliberately NOT `*.test.ts`: vitest owns that suffix, so the two
      // runners can never pick up each other's files.
      testMatch: '**/*.e2e.ts',
    },
  ],
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
