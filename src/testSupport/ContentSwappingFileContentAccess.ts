import { DocFile } from '../DocFile';
import { FakeFileContentAccess } from './FakeFileContentAccess';

/**
 * Simulates a CONCURRENT writer: swaps in new content right before the atomic
 * process() transform runs — the window between a store's precheck read and
 * its write. Exercises the in-transform re-check backstop.
 */
export class ContentSwappingFileContentAccess extends FakeFileContentAccess {
  constructor(private readonly concurrentContent: string) {
    super();
  }

  override async process(file: DocFile, transform: (content: string) => string): Promise<void> {
    this.seedNote(file.path, this.concurrentContent);
    return super.process(file, transform);
  }
}
