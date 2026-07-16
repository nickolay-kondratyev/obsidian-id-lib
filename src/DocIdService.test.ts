import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { DocIdServiceDefault } from './DocIdService';
import { DocIdStore } from './DocIdStore';
import { PathLock } from './CrossPluginPathLock';
import { makeTFile } from './testSupport/fileFactory';

class RecordingDocIdStore implements DocIdStore {
  readonly ensuredPaths: string[] = [];
  readonly gotPaths: string[] = [];

  constructor(private readonly id: string) {
  }

  async ensureId(file: TFile): Promise<string | null> {
    this.ensuredPaths.push(file.path);
    return this.id;
  }

  async getId(file: TFile): Promise<string | null> {
    this.gotPaths.push(file.path);
    return this.id;
  }
}

/** Pass-through PathLock that records the paths it was asked to guard. */
class RecordingPathLock implements PathLock {
  readonly lockedPaths: string[] = [];

  runExclusive<T>(path: string, task: () => Promise<T>): Promise<T> {
    this.lockedPaths.push(path);
    return task();
  }
}

interface Setup {
  service: DocIdServiceDefault;
  frontmatterStore: RecordingDocIdStore;
  canvasStore: RecordingDocIdStore;
  pathLock: RecordingPathLock;
}

function setup(): Setup {
  const frontmatterStore = new RecordingDocIdStore('frontmatter-id');
  const canvasStore = new RecordingDocIdStore('canvas-id');
  const pathLock = new RecordingPathLock();
  return {
    service: new DocIdServiceDefault(frontmatterStore, canvasStore, pathLock),
    frontmatterStore,
    canvasStore,
    pathLock,
  };
}

describe('DocIdServiceDefault', () => {
  describe('ensureDocId', () => {
    it('should dispatch .md files to the frontmatter store', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'notes/a.md' }))).toBe('frontmatter-id');
    });

    it('should dispatch .excalidraw.md files to the frontmatter store (extension is md)', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'draw/a.excalidraw.md' }))).toBe('frontmatter-id');
    });

    it('should dispatch .canvas files to the canvas store', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'boards/a.canvas' }))).toBe('canvas-id');
    });

    it('should return null for raw .excalidraw files without touching any store', async () => {
      // GIVEN
      const { service, frontmatterStore, canvasStore } = setup();
      // WHEN
      const id = await service.ensureDocId(makeTFile({ path: 'draw/raw.excalidraw' }));
      // THEN raw .excalidraw is intentionally unsupported (owner decision)
      expect({ id, calls: [...frontmatterStore.ensuredPaths, ...canvasStore.ensuredPaths] })
        .toEqual({ id: null, calls: [] });
    });

    it('should return null for untracked extensions', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.ensureDocId(makeTFile({ path: 'img/pic.png' }))).toBeNull();
    });

    it('should run the store call through PathLock.runExclusive keyed by the file path', async () => {
      // GIVEN
      const { service, pathLock, frontmatterStore } = setup();
      // WHEN
      await service.ensureDocId(makeTFile({ path: 'notes/a.md' }));
      // THEN the lock guarded exactly the ensured path
      expect({ lockedPaths: pathLock.lockedPaths, ensuredPaths: frontmatterStore.ensuredPaths })
        .toEqual({ lockedPaths: ['notes/a.md'], ensuredPaths: ['notes/a.md'] });
    });

    it('should NOT touch the lock for unsupported extensions', async () => {
      // GIVEN
      const { service, pathLock } = setup();
      // WHEN
      await service.ensureDocId(makeTFile({ path: 'img/pic.png' }));
      // THEN the dispatch null-check happens OUTSIDE the lock
      expect(pathLock.lockedPaths).toEqual([]);
    });
  });

  describe('getDocId', () => {
    it('should dispatch .md files to the frontmatter store read path', async () => {
      // GIVEN
      const { service, frontmatterStore } = setup();
      // WHEN
      const id = await service.getDocId(makeTFile({ path: 'notes/a.md' }));
      // THEN the read-only store path was used
      expect({ id, gotPaths: frontmatterStore.gotPaths })
        .toEqual({ id: 'frontmatter-id', gotPaths: ['notes/a.md'] });
    });

    it('should dispatch .canvas files to the canvas store read path', async () => {
      // GIVEN / WHEN
      const { service } = setup();
      // THEN
      expect(await service.getDocId(makeTFile({ path: 'boards/a.canvas' }))).toBe('canvas-id');
    });

    it('should never call ensureId (read-only contract)', async () => {
      // GIVEN
      const { service, frontmatterStore, canvasStore } = setup();
      // WHEN
      await service.getDocId(makeTFile({ path: 'notes/a.md' }));
      await service.getDocId(makeTFile({ path: 'boards/a.canvas' }));
      // THEN no write path was touched
      expect([...frontmatterStore.ensuredPaths, ...canvasStore.ensuredPaths]).toEqual([]);
    });

    it('should never touch the lock (lock-free read contract)', async () => {
      // GIVEN
      const { service, pathLock } = setup();
      // WHEN
      await service.getDocId(makeTFile({ path: 'notes/a.md' }));
      await service.getDocId(makeTFile({ path: 'boards/a.canvas' }));
      // THEN bulk read paths stay cheap — no lock traffic
      expect(pathLock.lockedPaths).toEqual([]);
    });

    it('should return null for unsupported extensions', async () => {
      // GIVEN / WHEN / THEN
      expect(await setup().service.getDocId(makeTFile({ path: 'draw/raw.excalidraw' }))).toBeNull();
    });
  });

  describe('isEligible', () => {
    it('should be true for .md files', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'notes/a.md' }))).toBe(true);
    });

    it('should be true for .excalidraw.md files (extension is md)', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'draw/a.excalidraw.md' }))).toBe(true);
    });

    it('should be true for .canvas files', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'boards/a.canvas' }))).toBe(true);
    });

    it('should be false for raw .excalidraw files', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'draw/raw.excalidraw' }))).toBe(false);
    });

    it('should be false for untracked extensions', () => {
      expect(setup().service.isEligible(makeTFile({ path: 'img/pic.png' }))).toBe(false);
    });
  });
});
