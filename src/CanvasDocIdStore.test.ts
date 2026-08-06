import { describe, expect, it, vi } from 'vitest';
import { CanvasDocIdStore } from './CanvasDocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { FakeFileContentAccess } from './testSupport/FakeFileContentAccess';
import { ContentSwappingFileContentAccess } from './testSupport/ContentSwappingFileContentAccess';

class FixedDocIdGenerator implements DocIdGenerator {
  constructor(private readonly id: string) {
  }

  generate(): string {
    return this.id;
  }
}

const GENERATED_ID = 'docid_BBBBBBBBBBBBBBBBBBBBB_E';

interface Setup {
  store: CanvasDocIdStore;
  fileAccess: FakeFileContentAccess;
}

function setup(): Setup {
  const fileAccess = new FakeFileContentAccess();
  const store = new CanvasDocIdStore(fileAccess, new FixedDocIdGenerator(GENERATED_ID));
  return { store, fileAccess };
}

function parseContent(fileAccess: FakeFileContentAccess, path: string): unknown {
  return JSON.parse(fileAccess.getContent(path) ?? 'null');
}

describe('CanvasDocIdStore', () => {
  describe('getId', () => {
    it('should return the existing metadata.frontmatter.id without modifying the file', async () => {
      // GIVEN a canvas that already carries an id
      const { store, fileAccess } = setup();
      const original = JSON.stringify({ nodes: [], metadata: { frontmatter: { id: 'canvas-id-1' } } });
      const file = fileAccess.seedNote('boards/a.canvas', original);
      // WHEN
      const id = await store.getId(file);
      // THEN id returned and content byte-identical
      expect({ id, content: fileAccess.getContent('boards/a.canvas') })
        .toEqual({ id: 'canvas-id-1', content: original });
    });

    it('should return null (and NOT generate an id) when the canvas has none', async () => {
      // GIVEN a canvas without an id
      const { store, fileAccess } = setup();
      const original = JSON.stringify({ nodes: [], edges: [] });
      const file = fileAccess.seedNote('boards/a.canvas', original);
      // WHEN
      const id = await store.getId(file);
      // THEN null, read-only (content untouched)
      expect({ id, content: fileAccess.getContent('boards/a.canvas') })
        .toEqual({ id: null, content: original });
    });

    it('should return null for malformed canvas JSON without throwing', async () => {
      // GIVEN malformed JSON
      const { store, fileAccess } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = fileAccess.seedNote('boards/bad.canvas', '{not json');
      // WHEN / THEN
      expect(await store.getId(file)).toBeNull();
      errorSpy.mockRestore();
    });

    it('should return null for an empty canvas file without writing or logging', async () => {
      // GIVEN an empty file (brand-new canvas) on the READ-ONLY path
      const { store, fileAccess } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = fileAccess.seedNote('boards/new.canvas', '');
      // WHEN
      const id = await store.getId(file);
      // THEN no id, file untouched, no error noise (empty is NOT malformed)
      expect({ id, content: fileAccess.getContent('boards/new.canvas'), errorCalls: errorSpy.mock.calls.length })
        .toEqual({ id: null, content: '', errorCalls: 0 });
      errorSpy.mockRestore();
    });
  });

  describe('ensureId', () => {
    it('should return the existing metadata.frontmatter.id without modifying the file', async () => {
      // GIVEN a canvas that already carries an id
      const { store, fileAccess } = setup();
      const original = JSON.stringify({ nodes: [], metadata: { frontmatter: { id: 'canvas-id-1' } } });
      const file = fileAccess.seedNote('boards/a.canvas', original);
      // WHEN
      const id = await store.ensureId(file);
      // THEN id returned and content byte-identical (no reformat)
      expect({ id, content: fileAccess.getContent('boards/a.canvas') })
        .toEqual({ id: 'canvas-id-1', content: original });
    });

    it('should write a generated id into existing metadata.frontmatter', async () => {
      // GIVEN a canvas with metadata.frontmatter but no id
      const { store, fileAccess } = setup();
      const file = fileAccess.seedNote(
        'boards/a.canvas',
        JSON.stringify({ nodes: [], edges: [], metadata: { frontmatter: {} } }),
      );
      // WHEN
      const id = await store.ensureId(file);
      // THEN
      expect({ id, canvas: parseContent(fileAccess, 'boards/a.canvas') }).toEqual({
        id: GENERATED_ID,
        canvas: { nodes: [], edges: [], metadata: { frontmatter: { id: GENERATED_ID } } },
      });
    });

    it('should create metadata.frontmatter when absent', async () => {
      // GIVEN a canvas without any metadata object
      const { store, fileAccess } = setup();
      const file = fileAccess.seedNote('boards/a.canvas', JSON.stringify({ nodes: [], edges: [] }));
      // WHEN
      await store.ensureId(file);
      // THEN
      expect(parseContent(fileAccess, 'boards/a.canvas')).toEqual({
        nodes: [],
        edges: [],
        metadata: { frontmatter: { id: GENERATED_ID } },
      });
    });

    it('should preserve other canvas data when adding the id', async () => {
      // GIVEN a canvas with nodes and unrelated metadata
      const { store, fileAccess } = setup();
      const file = fileAccess.seedNote(
        'boards/a.canvas',
        JSON.stringify({ nodes: [{ id: 'n1', type: 'text' }], metadata: { frontmatter: { tags: ['t'] } } }),
      );
      // WHEN
      await store.ensureId(file);
      // THEN
      expect(parseContent(fileAccess, 'boards/a.canvas')).toEqual({
        nodes: [{ id: 'n1', type: 'text' }],
        metadata: { frontmatter: { tags: ['t'], id: GENERATED_ID } },
      });
    });

    it('should return a non-string existing id as string', async () => {
      // GIVEN a numeric id
      const { store, fileAccess } = setup();
      const file = fileAccess.seedNote(
        'boards/a.canvas',
        JSON.stringify({ metadata: { frontmatter: { id: 42 } } }),
      );
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('42');
    });

    it('should NOT overwrite an object-valued id (unusable but occupied slot)', async () => {
      // GIVEN a canvas whose id slot holds an object
      const { store, fileAccess } = setup();
      const original = JSON.stringify({ metadata: { frontmatter: { id: { weird: true } } } });
      const file = fileAccess.seedNote('boards/a.canvas', original);
      // WHEN
      const id = await store.ensureId(file);
      // THEN no usable id, and the file is untouched
      expect({ id, content: fileAccess.getContent('boards/a.canvas') })
        .toEqual({ id: null, content: original });
    });

    it('should return null for malformed JSON without throwing or writing', async () => {
      // GIVEN a corrupt canvas file
      const { store, fileAccess } = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = fileAccess.seedNote('boards/bad.canvas', '{not json');
      // WHEN
      const id = await store.ensureId(file);
      // THEN
      expect({ id, content: fileAccess.getContent('boards/bad.canvas') })
        .toEqual({ id: null, content: '{not json' });
      consoleError.mockRestore();
    });

    it('should treat an empty canvas file as {} and write a generated id', async () => {
      // GIVEN an empty file (a brand-new canvas as created by Obsidian)
      const { store, fileAccess } = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = fileAccess.seedNote('boards/new.canvas', '');
      // WHEN
      const id = await store.ensureId(file);
      // THEN id returned, JSON written, and no "malformed canvas" error noise
      expect({ id, canvas: parseContent(fileAccess, 'boards/new.canvas'), errorCalls: consoleError.mock.calls.length })
        .toEqual({ id: GENERATED_ID, canvas: { metadata: { frontmatter: { id: GENERATED_ID } } }, errorCalls: 0 });
      consoleError.mockRestore();
    });

    it('should treat whitespace-only canvas content as {} and write a generated id', async () => {
      // GIVEN whitespace-only content
      const { store, fileAccess } = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = fileAccess.seedNote('boards/new.canvas', '  \n\t');
      // WHEN
      const id = await store.ensureId(file);
      // THEN same as the empty-string case
      expect({ id, canvas: parseContent(fileAccess, 'boards/new.canvas'), errorCalls: consoleError.mock.calls.length })
        .toEqual({ id: GENERATED_ID, canvas: { metadata: { frontmatter: { id: GENERATED_ID } } }, errorCalls: 0 });
      consoleError.mockRestore();
    });

    it('should write a generated id into an empty-object canvas', async () => {
      // GIVEN a canvas whose content is an empty JSON object
      const { store, fileAccess } = setup();
      const file = fileAccess.seedNote('boards/new.canvas', '{}');
      // WHEN
      await store.ensureId(file);
      // THEN
      expect(parseContent(fileAccess, 'boards/new.canvas'))
        .toEqual({ metadata: { frontmatter: { id: GENERATED_ID } } });
    });

    it('should return null when the canvas root is not an object', async () => {
      // GIVEN a JSON array as canvas root
      const { store, fileAccess } = setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const file = fileAccess.seedNote('boards/array.canvas', '[]');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBeNull();
      consoleError.mockRestore();
    });

    it('should NOT overwrite an id written concurrently between precheck and atomic write (re-check backstop)', async () => {
      // GIVEN an id-less canvas whose content gains an id right before the transform
      const concurrentContent = '{"metadata":{"frontmatter":{"id":"concurrent-id"}}}';
      const fileAccess = new ContentSwappingFileContentAccess(concurrentContent);
      const store = new CanvasDocIdStore(fileAccess, new FixedDocIdGenerator(GENERATED_ID));
      const file = fileAccess.seedNote('boards/a.canvas', '{"nodes":[]}');
      // WHEN
      await store.ensureId(file);
      // THEN the concurrent writer's id survives byte-identically
      expect(fileAccess.getContent('boards/a.canvas')).toBe(concurrentContent);
    });

    it('should RETURN the concurrently-written id (not the generated one) when it bails on write', async () => {
      // GIVEN an id-less canvas whose content gains a FOREIGN id right before the transform
      const concurrentContent = '{"metadata":{"frontmatter":{"id":"docid_FOREIGN_e"}}}';
      const fileAccess = new ContentSwappingFileContentAccess(concurrentContent);
      const store = new CanvasDocIdStore(fileAccess, new FixedDocIdGenerator(GENERATED_ID));
      const file = fileAccess.seedNote('boards/a.canvas', '{"nodes":[]}');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the caller receives the id actually persisted in the vault, not the discarded newId
      expect(id).toBe('docid_FOREIGN_e');
    });

    it('should return null when content turns malformed between precheck and atomic write', async () => {
      // GIVEN an id-less canvas whose content becomes malformed right before the transform
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fileAccess = new ContentSwappingFileContentAccess('{not json');
      const store = new CanvasDocIdStore(fileAccess, new FixedDocIdGenerator(GENERATED_ID));
      const file = fileAccess.seedNote('boards/a.canvas', '{"nodes":[]}');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the caller learns no usable id was persisted, and the malformed content is untouched
      expect({ id, content: fileAccess.getContent('boards/a.canvas') })
        .toEqual({ id: null, content: '{not json' });
      consoleError.mockRestore();
    });
  });
});
