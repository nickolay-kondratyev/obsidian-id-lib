import { test as base, createBdd } from 'playwright-bdd';
import { ObsidianHarness } from '../obsidianHarness';

/**
 * Fixtures for the e2e BDD tier — playwright-bdd's per-scenario state
 * mechanism (module-level mutable state in step files is banned).
 *
 * `obsidian` is TEST-scoped, i.e. one real Obsidian boot per scenario. That is
 * expensive on purpose: the tier is deliberately tiny, and a worker-scoped
 * harness would outlive the scenario and collide with the legacy specs'
 * per-file harness over the process-wide throwaway vault (see obsidianHarness.ts).
 */

/** The note a scenario is about, carried between its Given/When/Then steps. */
class NoteUnderTest {
  private vaultPath: string | undefined;
  private docId: string | null | undefined;

  seeded(vaultPath: string): void {
    this.vaultPath = vaultPath;
  }

  ensured(docId: string | null): void {
    this.docId = docId;
  }

  get path(): string {
    if (this.vaultPath === undefined) {
      throw new Error('No note in this scenario — a Given step must create one first');
    }
    return this.vaultPath;
  }

  /** The id the library returned; null means it declined to mint one. */
  get ensuredDocId(): string | null {
    if (this.docId === undefined) {
      throw new Error('No doc id in this scenario — a When step must ensure one first');
    }
    return this.docId;
  }
}

export const test = base.extend<{ obsidian: ObsidianHarness; note: NoteUnderTest }>({
  obsidian: async ({}, use) => {
    const harness = await ObsidianHarness.launch();
    try {
      await use(harness);
    } finally {
      await harness.close();
    }
  },
  note: async ({}, use) => {
    await use(new NoteUnderTest());
  },
});

export const { Given, When, Then } = createBdd(test);
