import { expect } from 'vitest';
import { Given, Then, When, setWorldConstructor } from 'quickpickle';
import { DocIdWorld } from './DocIdWorld';

/**
 * Step definitions for features/domain/doc-id.feature.
 *
 * Steps stay thin — parse, delegate, assert — and every Then delegates to the
 * library's own `getDocId` (an exported function returning a value) so the
 * assertion is one visible line matching the scenario's claim.
 */

setWorldConstructor(DocIdWorld);

const NOTE_BODY = 'Body text.\n';

Given('a note {string} without a doc id', (world: DocIdWorld, path: string) => {
  world.note = world.files.seedNote(path, NOTE_BODY);
});

Given('a note {string} with the doc id {string}', (world: DocIdWorld, path: string, docId: string) => {
  world.note = world.files.seedNote(path, `---\nid: ${docId}\n---\n${NOTE_BODY}`);
});

When('the user ensures the note has a doc id', async (world: DocIdWorld) => {
  await world.docIdService.ensureDocId(world.note);
});

Then('the note has a doc id', async (world: DocIdWorld) => {
  expect(await world.docIdService.getDocId(world.note)).not.toBeNull();
});

Then('the note has no doc id', async (world: DocIdWorld) => {
  expect(await world.docIdService.getDocId(world.note)).toBeNull();
});

Then("the note's doc id is {string}", async (world: DocIdWorld, expectedDocId: string) => {
  expect(await world.docIdService.getDocId(world.note)).toBe(expectedDocId);
});
