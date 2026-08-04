import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { quickpickle, type QuickPickleConfigSetting } from 'quickpickle';

/**
 * `npm test` runs BOTH vitest tiers:
 *
 * - `unit`   — plain vitest specs next to the source they cover.
 * - `domain` — the domain BDD tier: `features/domain/*.feature` run by
 *              quickpickle (see docs-internal/bdd-testing-strategy.md).
 *
 * They are separate projects so the unit watch loop never picks up Gherkin
 * specs and vice versa, and so each gets its own includes and setup files.
 */

// 'obsidian' npm package is type-declarations-only (no runtime JS).
// Tests run against a minimal stand-in instead. Repeated per project on
// purpose: projects do NOT inherit `resolve` from the root config.
const obsidianMockAlias = {
  obsidian: fileURLToPath(new URL('./src/testSupport/obsidianMock.ts', import.meta.url)),
};

/**
 * The tag vocabulary under `features/` is CLOSED: no tag may decide WHETHER a
 * scenario runs, or a red scenario can be made to disappear instead of being
 * implemented. quickpickle ships tags that do exactly that (@todo/@wip, @skip,
 * @fails, @soft), so every one of those lists is emptied here.
 */
const quickPickleOptions: QuickPickleConfigSetting = {
  todoTags: [],
  skipTags: [],
  failTags: [],
  softFailTags: [],
};

export default defineConfig({
  plugins: [quickpickle(quickPickleOptions)],
  resolve: { alias: obsidianMockAlias },
  test: {
    projects: [
      {
        resolve: { alias: obsidianMockAlias },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [quickpickle(quickPickleOptions)],
        resolve: { alias: obsidianMockAlias },
        test: {
          name: 'domain',
          include: ['features/domain/**/*.feature'],
          setupFiles: ['./tests/domain/steps/docId.steps.ts'],
          quickpickle: quickPickleOptions,
        },
      },
    ],
  },
});
