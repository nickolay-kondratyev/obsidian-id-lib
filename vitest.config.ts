import { defineConfig } from 'vitest/config';
import { quickpickle } from 'quickpickle';

/**
 * `npm test` runs BOTH vitest tiers:
 *
 * - `unit`   — plain vitest specs next to the source they cover, plus the
 *              repo-level checks under `tests/` (e.g. the feature-file tag
 *              audit, which must run without booting either BDD runner).
 * - `domain` — the domain BDD tier: `features/domain/*.feature` run by
 *              quickpickle (see docs-internal/bdd-testing-strategy.md).
 *
 * They are separate projects so the unit watch loop never picks up Gherkin
 * specs and vice versa, and so each gets its own includes and setup files.
 *
 * WHY-NOT a `quickpickle` options block disabling its @skip/@todo/@fails tags:
 * it cannot be done from config — quickpickle merges options with lodash
 * `defaultsDeep`, which merges arrays INDEX-WISE, so an empty list leaves every
 * default tag in place (verified: an `@skip`ped scenario still skipped, with
 * the run green). The closed tag vocabulary is enforced statically instead, by
 * `tests/features/FeatureFileTagAudit.ts` in the `unit` project.
 */

// WHY-NOT an 'obsidian' alias to a runtime stand-in: the vitest tiers no longer
// import 'obsidian' at RUNTIME at all. The domain layer is forbidden to import
// it (.dependency-cruiser.cjs), and the src/obsidian/ adapters use it only in
// type position, where the import is erased. A stand-in would be dead weight.

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        },
      },
      {
        plugins: [quickpickle()],
        test: {
          name: 'domain',
          include: ['features/domain/**/*.feature'],
          // Registers every tests/domain/steps/*.steps.ts — see allSteps.ts for
          // why the step files are not listed here individually.
          setupFiles: ['./tests/domain/steps/allSteps.ts'],
        },
      },
    ],
  },
});
