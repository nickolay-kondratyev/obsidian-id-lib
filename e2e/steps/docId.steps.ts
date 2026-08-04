import { expect } from '@playwright/test';
import { Given, Then, When } from './obsidianFixtures';

/**
 * Step definitions for features/e2e/doc-id.feature.
 *
 * Same step text as the domain tier by convention (nothing is shared at
 * runtime), so a feature reads the same in both tiers. These steps drive the
 * REAL app: no fakes, no stubs — that is the whole point of the tier.
 */

const NOTE_BODY = 'Body text.\n';

Given('a note {string} without a doc id', async ({ obsidian, note }, vaultPath: string) => {
  await obsidian.createFile(vaultPath, NOTE_BODY);
  note.seeded(vaultPath);
});

When('the user ensures the note has a doc id', async ({ obsidian, note }) => {
  note.ensured(await obsidian.ensureDocId(note.path));
});

Then("the note's doc id is on disk", ({ obsidian, note }) => {
  expect(obsidian.readFileFromDisk(note.path)).toContain(`id: ${note.ensuredDocId}`);
});
