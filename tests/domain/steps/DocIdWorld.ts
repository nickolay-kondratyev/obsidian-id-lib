import { QuickPickleWorld } from 'quickpickle';
import type { DocFile } from '../../../src/DocFile';
import { CanvasDocIdStore } from '../../../src/CanvasDocIdStore';
import { CrossPluginPathLock } from '../../../src/CrossPluginPathLock';
import { DocIdGeneratorDefault } from '../../../src/DocIdGenerator';
import { DocIdServiceDefault } from '../../../src/DocIdService';
import type { DocIdService } from '../../../src/DocIdService';
import { FrontmatterDocIdStore } from '../../../src/FrontmatterDocIdStore';
import { FakeFileContentAccess } from '../../../src/testSupport/FakeFileContentAccess';

/**
 * Per-scenario state for the domain BDD tier: a fake vault plus the library
 * wired exactly as `DocIdServices.createDefault` wires it, minus the real
 * Obsidian `Vault`.
 *
 * A world instance per scenario is quickpickle's mechanism for scenario state —
 * module-level mutable state in step files is banned, since it leaks between
 * scenarios and breaks parallel execution.
 */
export class DocIdWorld extends QuickPickleWorld {
  readonly files = new FakeFileContentAccess();
  readonly docIdService: DocIdService = DocIdWorld.wireLibrary(this.files);

  /**
   * The note the scenario is about. Set by a Given step; reading it before
   * then is a broken scenario, so it fails loudly instead of handing out
   * `undefined` for a step to trip over later.
   */
  private noteUnderTest: DocFile | undefined;

  set note(file: DocFile) {
    this.noteUnderTest = file;
  }

  get note(): DocFile {
    if (this.noteUnderTest === undefined) {
      throw new Error('No note in this scenario — a Given step must seed one first');
    }
    return this.noteUnderTest;
  }

  private static wireLibrary(files: FakeFileContentAccess): DocIdService {
    const generator = new DocIdGeneratorDefault();
    return new DocIdServiceDefault(
      new FrontmatterDocIdStore(files, generator),
      new CanvasDocIdStore(files, generator),
      new CrossPluginPathLock(),
    );
  }
}
