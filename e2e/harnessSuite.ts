import { test } from '@playwright/test';
import { ObsidianHarness } from './obsidianHarness';

/**
 * Wires ONE real-Obsidian harness into the calling spec file: serial execution,
 * boot before the file's tests, teardown after.
 *
 * Every spec file needs exactly this lifecycle, and getting it subtly wrong is
 * expensive — a missed `close()` leaves an Obsidian process alive past the suite.
 * So it lives here once, and specs just call `const harness = useObsidianHarness()`.
 *
 * The returned accessor is a FUNCTION because the harness only exists once
 * `beforeAll` has run, i.e. after the spec file's top level has executed.
 */
export function useObsidianHarness(): () => ObsidianHarness {
  test.describe.configure({ mode: 'serial' });

  let harness: ObsidianHarness | undefined;

  test.beforeAll(async () => {
    harness = await ObsidianHarness.launch();
  });

  test.afterAll(async () => {
    // Guarded: when launch() itself failed there is nothing to close, and an
    // unguarded call would throw a TypeError that BURIES the real boot failure.
    await harness?.close();
    harness = undefined;
  });

  return () => {
    if (harness === undefined) {
      throw new Error('e2e: harness accessed outside a test (it exists only between beforeAll and afterAll)');
    }
    return harness;
  };
}
