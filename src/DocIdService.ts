import { DocFile } from './DocFile';
import { DocIdStore } from './DocIdStore';
import { PathLock } from './CrossPluginPathLock';

/**
 * Ensures every opened document carries a persistent doc id
 * (docid_{24 base36}_e). Consumers typically dispatch to it on file focus.
 */
export interface DocIdService {
  /**
   * Returns the doc id for the file, generating and persisting one when
   * missing. An existing id is used as-is even if it does not follow the
   * docid_ format, and the file stays untouched.
   * Returns null for unsupported formats (e.g. raw .excalidraw JSON) or
   * unreadable content.
   */
  ensureDocId(file: DocFile): Promise<string | null>;

  /**
   * READ-ONLY doc id lookup: existing id or null. NEVER writes — safe for
   * bulk read paths (e.g. resolving visit history for every vault file).
   */
  getDocId(file: DocFile): Promise<string | null>;

  /**
   * True when the file's format can carry a doc id (md incl. .excalidraw.md,
   * canvas). False for formats ensureDocId would skip (e.g. raw .excalidraw).
   */
  isEligible(file: DocFile): boolean;
}

export class DocIdServiceDefault implements DocIdService {
  private readonly storeByExtension: ReadonlyMap<string, DocIdStore>;

  /**
   * pathLock is REQUIRED: ensureDocId is the single documented entry point
   * for id creation, and the cross-plugin lock guarding it is the point of
   * this library — an unlocked wiring must not happen by accident.
   */
  constructor(
    frontmatterDocIdStore: DocIdStore,
    canvasDocIdStore: DocIdStore,
    private readonly pathLock: PathLock,
  ) {
    this.storeByExtension = new Map<string, DocIdStore>([
      // 'md' covers Excalidraw's .excalidraw.md files too (extension is 'md').
      ['md', frontmatterDocIdStore],
      ['canvas', canvasDocIdStore],
      // WHY-NOT 'excalidraw': raw .excalidraw files are pure JSON with no
      // frontmatter concept and no agreed id location — intentionally skipped
      // (owner decision).
    ]);
  }

  async ensureDocId(file: DocFile): Promise<string | null> {
    const store = this.storeByExtension.get(file.extension);
    if (!store) {
      return null;
    }
    // The WHOLE read-decide-write is exclusive per path, so two plugins
    // bundling this lib cannot both observe "no id" and both write one.
    return this.pathLock.runExclusive(file.path, () => store.ensureId(file));
  }

  async getDocId(file: DocFile): Promise<string | null> {
    const store = this.storeByExtension.get(file.extension);
    if (!store) {
      return null;
    }
    // Lock-free on purpose: bulk read paths (e.g. a heatmap resolving ids for
    // every vault file) must stay cheap and must never touch the write lock.
    return store.getId(file);
  }

  isEligible(file: DocFile): boolean {
    return this.storeByExtension.has(file.extension);
  }
}
