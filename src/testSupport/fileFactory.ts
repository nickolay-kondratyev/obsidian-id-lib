import { DocFile } from '../DocFile';

/**
 * Builds a DocFile for tests, deriving the extension from the path the way
 * Obsidian's own `TFile.extension` does.
 *
 * A fake is a PLAIN OBJECT with no host class to instantiate and no cast —
 * that is precisely what the domain boundary buys (see src/DocFile.ts).
 */
export function makeDocFile(path: string): DocFile {
  const name = path.split('/').at(-1) ?? path;
  const dotIdx = name.lastIndexOf('.');
  return {
    path,
    extension: dotIdx > 0 ? name.slice(dotIdx + 1) : '',
  };
}
