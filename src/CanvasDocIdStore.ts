import { DocFile } from './DocFile';
import { DocIdStore, DocIdValues, ExistingIdState } from './DocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { FileContentAccess } from './FileContentAccess';

const FRONTMATTER_ID_KEY = 'id';
// Obsidian serializes .canvas JSON with tab indentation — match it on write.
const CANVAS_JSON_INDENT = '\t';

/** Outcome of one atomic canvas write attempt. */
interface WriteOutcome {
  content: string;
  id: string | null;
}

/**
 * Doc id store for .canvas files: the id lives in the canvas JSON under
 * metadata.frontmatter.id. Missing metadata/frontmatter objects are created.
 * Empty/whitespace-only content is treated as an empty canvas ({}) — a
 * brand-new canvas is a 0-byte file and gets an id on first focus.
 * Malformed canvas JSON never throws — returns null (one bad file must not
 * break focus handling).
 */
export class CanvasDocIdStore implements DocIdStore {
  constructor(
    private readonly fileContentAccess: FileContentAccess,
    private readonly docIdGenerator: DocIdGenerator,
  ) {
  }

  async ensureId(file: DocFile): Promise<string | null> {
    const canvas = this.parseCanvas(await this.fileContentAccess.cachedRead(file), file.path);
    if (canvas === null) {
      return null;
    }

    const existing = this.readIdState(canvas);
    if (existing.kind === 'present') {
      return existing.id;
    }

    const newId = this.docIdGenerator.generate();
    // Capture the id actually observed/written inside the atomic transform: on
    // a bail we must report the id that persisted in the vault, NOT the newId we
    // discarded — otherwise consumers indexing by the returned id diverge from
    // the file (README idempotency-backstop guarantee).
    let resultId: string | null = null;
    await this.fileContentAccess.process(file, (content) => {
      const outcome = this.writeIdIntoContent(content, newId, file.path);
      resultId = outcome.id;
      return outcome.content;
    });
    return resultId;
  }

  async getId(file: DocFile): Promise<string | null> {
    const canvas = this.parseCanvas(await this.fileContentAccess.cachedRead(file), file.path);
    if (canvas === null) {
      return null;
    }
    const existing = this.readIdState(canvas);
    return existing.kind === 'present' ? existing.id : null;
  }

  // ── private ─────────────────────────────────────────────────────────────────

  /**
   * Re-parses inside the atomic read-modify-write: the content may have changed
   * since the precheck read. Bails (content unchanged) when it turned malformed
   * or already gained an id, reporting the id that persists in that case.
   */
  private writeIdIntoContent(content: string, newId: string, path: string): WriteOutcome {
    const current = this.parseCanvas(content, path);
    if (current === null) {
      return { content, id: null };
    }
    const existing = this.readIdState(current);
    if (existing.kind === 'present') {
      return { content, id: existing.id };
    }
    this.writeId(current, newId);
    return { content: JSON.stringify(current, null, CANVAS_JSON_INDENT), id: newId };
  }

  private parseCanvas(content: string, path: string): Record<string, unknown> | null {
    // A brand-new canvas is created by Obsidian as an EMPTY file — treat
    // empty/whitespace-only content as an empty canvas object so it can
    // receive a doc id on first focus (not as malformed JSON).
    if (content.trim() === '') {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(content);
      if (this.isRecord(parsed)) {
        return parsed;
      }
      console.error(`[obsidian-id-lib][CanvasDocIdStore] canvas root is not an object path=[${path}]`);
      return null;
    } catch (error) {
      console.error(`[obsidian-id-lib][CanvasDocIdStore] malformed canvas JSON path=[${path}]`, error);
      return null;
    }
  }

  private readIdState(canvas: Record<string, unknown>): ExistingIdState {
    const metadata = canvas['metadata'];
    if (!this.isRecord(metadata)) {
      return { kind: 'absent' };
    }
    const frontmatter = metadata['frontmatter'];
    if (!this.isRecord(frontmatter)) {
      return { kind: 'absent' };
    }
    return DocIdValues.read(frontmatter[FRONTMATTER_ID_KEY]);
  }

  /** Sets metadata.frontmatter.id, creating the intermediate objects if absent. */
  private writeId(canvas: Record<string, unknown>, id: string): void {
    const metadata = this.isRecord(canvas['metadata']) ? canvas['metadata'] : {};
    canvas['metadata'] = metadata;
    const frontmatter = this.isRecord(metadata['frontmatter']) ? metadata['frontmatter'] : {};
    metadata['frontmatter'] = frontmatter;
    frontmatter[FRONTMATTER_ID_KEY] = id;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
