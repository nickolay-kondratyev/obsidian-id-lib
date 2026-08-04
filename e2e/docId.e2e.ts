import { expect, test } from '@playwright/test';
import { useObsidianHarness } from './harnessSuite';

/**
 * Smoke coverage that the library works inside a REAL Obsidian: the wiring a
 * consumer writes (`DocIdServices.createDefault(app.vault)`) mints an id and
 * Obsidian's own `Vault.process` really lands it on disk.
 *
 * Scope guard (see §7 of the e2e setup note): anything a fake vault can prove
 * belongs in the vitest suite, not here — every case here costs an Electron boot.
 */

const obsidian = useObsidianHarness();

test('WHEN ensureDocId runs on a note without frontmatter THEN the returned id is on disk', async () => {
  const harness = obsidian();

  const docId = await harness.ensureDocId('plain.md');

  expect(harness.readFileFromDisk('plain.md')).toContain(`id: ${docId}`);
});

test('WHEN a note is created in the running app THEN ensureDocId puts an id on disk', async () => {
  const harness = obsidian();
  await harness.createFile('created-at-runtime.md', 'Born inside a running Obsidian.\n');

  const docId = await harness.ensureDocId('created-at-runtime.md');

  expect(harness.readFileFromDisk('created-at-runtime.md')).toContain(`id: ${docId}`);
});
