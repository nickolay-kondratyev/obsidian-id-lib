import { expect, test } from '@playwright/test';
import { ObsidianHarness } from './obsidianHarness';

/**
 * Smoke coverage that the library works inside a REAL Obsidian: the wiring a
 * consumer writes (`DocIdServices.createDefault(app.vault)`) mints an id and
 * Obsidian's own `Vault.process` really lands it on disk.
 *
 * Scope guard (see §7 of the e2e setup note): anything a fake vault can prove
 * belongs in the vitest suite, not here — every case here costs an Electron boot.
 */

test.describe.configure({ mode: 'serial' });

let harness: ObsidianHarness;

test.beforeAll(async () => {
  harness = await ObsidianHarness.launch();
});

test.afterAll(async () => {
  await harness.close();
});

test('WHEN ensureDocId runs on a note without frontmatter THEN the returned id is on disk', async () => {
  const docId = await harness.ensureDocId('plain.md');

  expect(harness.readFileFromDisk('plain.md')).toContain(`id: ${docId}`);
});
