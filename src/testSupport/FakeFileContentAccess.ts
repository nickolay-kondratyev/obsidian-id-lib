import { DocFile } from '../DocFile';
import { FileContentAccess } from '../FileContentAccess';
import { makeDocFile } from './fileFactory';

/**
 * In-memory FileContentAccess for unit tests. Mirrors the contract of
 * VaultFileContentAccess (throws on missing files).
 */
export class FakeFileContentAccess implements FileContentAccess {
  private readonly contentByPath = new Map<string, string>();
  /** Number of process() calls — lets tests assert the no-write fast path. */
  processCallCount = 0;
  /** Number of cachedRead() calls — lets tests assert the no-read fast path. */
  cachedReadCallCount = 0;

  /** Seeds a note's content directly. */
  seedNote(path: string, content: string): DocFile {
    this.contentByPath.set(path, content);
    return makeDocFile(path);
  }

  getContent(path: string): string | undefined {
    return this.contentByPath.get(path);
  }

  async cachedRead(file: DocFile): Promise<string> {
    this.cachedReadCallCount++;
    const content = this.contentByPath.get(file.path);
    if (content === undefined) {
      throw new Error(`File not found: ${file.path}`);
    }
    return content;
  }

  async process(file: DocFile, transform: (content: string) => string): Promise<void> {
    this.processCallCount++;
    const content = this.contentByPath.get(file.path);
    if (content === undefined) {
      throw new Error(`File not found: ${file.path}`);
    }
    this.contentByPath.set(file.path, transform(content));
  }
}
