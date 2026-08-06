import { expect, test } from '@playwright/test';
import { useObsidianHarness } from './harnessSuite';

/**
 * The real-Obsidian guarantees a fake vault CANNOT prove — each one depends on
 * Obsidian's own behaviour, not the library's, so only a real app boot is
 * evidence. Kept deliberately few (§7 of the e2e setup note): every case here
 * costs an Electron boot, and the three tests below share ONE.
 *
 *  1. Canvas id survives Obsidian's OWN canvas serializer (round-trip).
 *  2. The read path (`getDocId`) never writes — proven against a real vault.
 *  3. An id written in one app session is read back off DISK in the next.
 */

const obsidian = useObsidianHarness();

/** Reads the canvas id from the on-disk JSON at its documented location. */
function canvasIdOnDisk(rawCanvasJson: string): unknown {
  const parsed = JSON.parse(rawCanvasJson) as { metadata?: { frontmatter?: { id?: unknown } } };
  return parsed.metadata?.frontmatter?.id;
}

test('WHEN a canvas gets an id AND core canvas re-saves it THEN the id survives on disk', async () => {
  const harness = obsidian();

  // The library stores the canvas id at metadata.frontmatter.id — a key no
  // Obsidian release introduced; it rides the canvas format's arbitrary-key
  // forward compatibility. Prove the write lands THERE...
  const docId = await harness.ensureDocId('diagram.canvas');
  expect(canvasIdOnDisk(harness.readFileFromDisk('diagram.canvas'))).toBe(docId);

  // ...and that Obsidian's own canvas editor, on a real edit + save, does not
  // drop that unknown key (the single highest-value assertion in the suite).
  await harness.roundTripCanvasThroughCore('diagram.canvas');

  expect(canvasIdOnDisk(harness.readFileFromDisk('diagram.canvas'))).toBe(docId);
});

test('WHEN getDocId runs on an id-less note THEN it returns null AND writes nothing', async () => {
  const harness = obsidian();
  await harness.createFile('read-only-note.md', 'A note the read path must never touch.\n');
  const before = harness.readFileFromDisk('read-only-note.md');

  const id = await harness.getDocId('read-only-note.md');

  expect(id).toBeNull();
  // Read paths mint nothing: the bytes on disk are byte-for-byte unchanged.
  expect(harness.readFileFromDisk('read-only-note.md')).toBe(before);
});

test('WHEN an id is written then Obsidian restarts THEN the next session reads it off disk', async () => {
  const harness = obsidian();
  await harness.createFile('restart-note.md', 'Survives across an app restart.\n');
  const idFromFirstSession = await harness.ensureDocId('restart-note.md');
  expect(idFromFirstSession).not.toBeNull();

  // Fresh Obsidian process, same vault copy, NOT re-seeded — a brand-new
  // in-memory metadataCache. getDocId returning the same id can only come from
  // reading the id back off disk.
  await harness.relaunch();

  expect(await harness.getDocId('restart-note.md')).toBe(idFromFirstSession);
});
