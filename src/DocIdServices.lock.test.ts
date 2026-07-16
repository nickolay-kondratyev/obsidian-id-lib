import { describe, expect, it } from 'vitest';
import { DocIdServiceDefault } from './DocIdService';
import { DocIdGenerator } from './DocIdGenerator';
import { FrontmatterDocIdStore } from './FrontmatterDocIdStore';
import { CanvasDocIdStore } from './CanvasDocIdStore';
import { CrossPluginPathLock } from './CrossPluginPathLock';
import { FakeFileContentAccess } from './testSupport/FakeFileContentAccess';

class FixedDocIdGenerator implements DocIdGenerator {
  constructor(private readonly id: string) {
  }

  generate(): string {
    return this.id;
  }
}

const ID_OF_PLUGIN_A = 'docid_aaaaaaaaaaaaaaaaaaaaaaaa_e';
const ID_OF_PLUGIN_B = 'docid_bbbbbbbbbbbbbbbbbbbbbbbb_e';

/**
 * Wires one "plugin": its OWN service + stores + lock instance (its own
 * bundled lib copy), sharing the given window-like host and vault fake.
 */
function makePluginService(
  host: object,
  fileAccess: FakeFileContentAccess,
  generatedId: string,
): DocIdServiceDefault {
  const generator = new FixedDocIdGenerator(generatedId);
  return new DocIdServiceDefault(
    new FrontmatterDocIdStore(fileAccess, generator),
    new CanvasDocIdStore(fileAccess, generator),
    new CrossPluginPathLock(host),
  );
}

describe('DocIdServiceDefault with CrossPluginPathLock (two bundled copies)', () => {
  describe('ensureDocId', () => {
    it('should produce ONE write and ONE id when two plugins race on the same id-less md file (AC-S1)', async () => {
      // GIVEN two plugins (separate lock instances) sharing one window host
      // and one vault, both focusing the same id-less note
      const host = {};
      const fileAccess = new FakeFileContentAccess();
      const serviceA = makePluginService(host, fileAccess, ID_OF_PLUGIN_A);
      const serviceB = makePluginService(host, fileAccess, ID_OF_PLUGIN_B);
      const file = fileAccess.seedNote('notes/a.md', '# no id yet');
      // WHEN both ensure concurrently
      const [idA, idB] = await Promise.all([
        serviceA.ensureDocId(file),
        serviceB.ensureDocId(file),
      ]);
      // THEN the second writer's FAST-PATH read saw the first id and bailed:
      // both callers got the SAME id and only one write happened
      expect({ idA, idB, writes: fileAccess.processCallCount })
        .toEqual({ idA: ID_OF_PLUGIN_A, idB: ID_OF_PLUGIN_A, writes: 1 });
    });

    it('should produce ONE write and ONE id when two plugins race on the same id-less canvas (AC-S1)', async () => {
      // GIVEN
      const host = {};
      const fileAccess = new FakeFileContentAccess();
      const serviceA = makePluginService(host, fileAccess, ID_OF_PLUGIN_A);
      const serviceB = makePluginService(host, fileAccess, ID_OF_PLUGIN_B);
      const file = fileAccess.seedNote('boards/a.canvas', '{"nodes":[]}');
      // WHEN
      const [idA, idB] = await Promise.all([
        serviceA.ensureDocId(file),
        serviceB.ensureDocId(file),
      ]);
      // THEN
      expect({ idA, idB, writes: fileAccess.processCallCount })
        .toEqual({ idA: ID_OF_PLUGIN_A, idB: ID_OF_PLUGIN_A, writes: 1 });
    });
  });

  describe('getDocId', () => {
    it('should never create the lock registry on the host nor write (AC-S2, lock-free read path)', async () => {
      // GIVEN a service whose lock points at a fresh host
      const host: Record<string, unknown> = {};
      const fileAccess = new FakeFileContentAccess();
      const service = makePluginService(host, fileAccess, ID_OF_PLUGIN_A);
      const file = fileAccess.seedNote('notes/a.md', '---\nid: existing\n---\n');
      // WHEN
      const id = await service.getDocId(file);
      // THEN the host stays key-free and no write happened
      expect({ id, hostKeys: Object.keys(host), writes: fileAccess.processCallCount })
        .toEqual({ id: 'existing', hostKeys: [], writes: 0 });
    });
  });
});
