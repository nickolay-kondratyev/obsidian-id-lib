import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static audit of the tag vocabulary under `features/`.
 *
 * WHY this is static rather than a runner check: a tag that removes a scenario
 * produces no failure at all, only an ABSENCE, so neither runner can report it.
 * Both runners here assign behaviour to tags that neither config can switch
 * off — quickpickle's `@skip`/`@todo`/`@wip`/`@fails`/`@soft` (its config merge
 * is a lodash `defaultsDeep`, which merges arrays index-wise, so an empty list
 * cannot override the defaults), and playwright-bdd's `@skip`/`@fixme`/`@only`
 * (`bddgen` drops a `@skip`ped scenario from its output and exits 0, silently).
 * A pasted `@skip` would therefore turn a red scenario green in either tier.
 *
 * So the vocabulary is CLOSED, and in this repo it is EMPTY: no tag carries a
 * legitimate meaning here (the strategy doc's viewport-routing pair guards two
 * browser projects; this e2e tier drives one real Obsidian window). Widening
 * `PERMITTED_TAGS` is therefore a deliberate act with a test diff attached.
 *
 * See docs-internal/bdd-testing-strategy.md, "Enforcement".
 */

/** Tags allowed to appear under `features/`. Empty on purpose — see above. */
export const PERMITTED_TAGS: readonly string[] = [];

const FEATURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'features',
);

const FEATURE_FILE_SUFFIX = '.feature';

/**
 * A Gherkin tag line holds nothing but `@tag` tokens, so a line whose first
 * non-space character is `@` is a tag line and every token on it is a tag.
 */
const TAG_LINE_PATTERN = /^\s*@\S/;
const TAG_TOKEN_PATTERN = /@\S+/g;

/** One disallowed tag, located precisely enough to fix without searching. */
export interface TagViolation {
  /** Repo-relative, e.g. `features/e2e/doc-id.feature`. */
  readonly file: string;
  /** 1-based. */
  readonly line: number;
  readonly tag: string;
}

/** Scans feature files for tags outside the permitted vocabulary. */
export class FeatureFileTagAudit {
  constructor(private readonly featuresDir: string = FEATURES_DIR) {}

  /** Repo-relative paths of every feature file the audit covers. */
  auditedFiles(): string[] {
    return fs
      .readdirSync(this.featuresDir, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith(FEATURE_FILE_SUFFIX))
      .map((entry) => path.posix.join('features', entry.split(path.sep).join('/')))
      .sort();
  }

  /** Every disallowed tag found, empty when the vocabulary holds. */
  violations(): TagViolation[] {
    return this.auditedFiles().flatMap((file) => this.violationsIn(file));
  }

  private violationsIn(repoRelativeFile: string): TagViolation[] {
    const absolute = path.join(this.featuresDir, '..', repoRelativeFile);
    return fs
      .readFileSync(absolute, 'utf8')
      .split('\n')
      .flatMap((text, index) =>
        TAG_LINE_PATTERN.test(text)
          ? [...(text.match(TAG_TOKEN_PATTERN) ?? [])]
              .filter((tag) => !PERMITTED_TAGS.includes(tag))
              .map((tag) => ({ file: repoRelativeFile, line: index + 1, tag }))
          : [],
      );
  }
}
