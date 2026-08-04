import { expect, test } from '@playwright/test';
import { useObsidianHarness } from './harnessSuite';

/**
 * Guards the HARNESS, not the library: real pointer clicks must actually land
 * on Obsidian's UI.
 *
 * WHY this is worth an Electron boot: when the viewport override regresses,
 * Obsidian falls back to its ~300×200 headless window, panes overflow
 * off-screen and clicks silently miss — while every DOM-only assertion keeps
 * passing. Without this guard that shows up much later as "the new UI spec is
 * flaky", which is a genuinely expensive thing to debug. Here it fails loudly,
 * next to the cause.
 */

const obsidian = useObsidianHarness();

test('WHEN a ribbon action is really clicked THEN Obsidian reacts to the pointer event', async () => {
  const { page } = obsidian();

  // Any stock ribbon action with a stable label would do; the command palette
  // is the cheapest one with an unmistakable, self-contained DOM result.
  await page.locator('[aria-label="Open command palette"]').first().click();

  await expect(page.locator('.prompt input')).toBeVisible();
});
