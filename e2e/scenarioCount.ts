import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import type { FeatureChild, RuleChild, Scenario } from '@cucumber/messages';

/**
 * Pure scenario-counting over `features/e2e/` on disk, for the count reconciler
 * (see scenarioCountReporter.ts and docs-internal/bdd-testing-strategy.md,
 * "Viewport routing").
 *
 * WHY it reads the DIRECTORY, not the `features` glob passed to
 * `defineBddConfig`: the reconciler exists to catch a narrowed glob, a dropped
 * project, a changed `testDir`. An expectation derived through the very config
 * under test would move in lockstep with the bypass and prove nothing. So the
 * count comes from an independent parse of the raw `.feature` text with
 * `@cucumber/gherkin` (a DIRECT devDependency, declared in package.json, not
 * reached for inside playwright-bdd's install layout).
 */

/**
 * The only Gherkin dialect this counter understands. A `# language:` header for
 * any other dialect localises the keywords, so `Scenario`/`Scenario Outline`
 * would no longer be recognised and the count would be silently wrong — the
 * counter REPORTS that (throws) rather than miscount. See countScenariosInFeature.
 */
export const ENGLISH_DIALECT = 'en';

const FEATURE_FILE_SUFFIX = '.feature';

/** `features/e2e/`, resolved from this file's location — never from the config. */
export const E2E_FEATURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'features',
  'e2e',
);

/** A feature file written in a dialect this counter cannot count honestly. */
export class NonEnglishFeatureError extends Error {
  constructor(
    readonly file: string,
    readonly dialect: string,
  ) {
    super(
      `Feature file "${file}" declares Gherkin dialect "${dialect}"; the scenario-count ` +
        `reconciler reads only the "${ENGLISH_DIALECT}" dialect and refuses to guess a count ` +
        `for another. Keep e2e features in English, or teach the counter this dialect.`,
    );
    this.name = 'NonEnglishFeatureError';
  }
}

/** One feature file and how many executable scenarios it contributes. */
export interface FeatureScenarioCount {
  /** File name within `features/e2e/`, e.g. `doc-id.feature`. */
  readonly file: string;
  readonly scenarios: number;
}

/** The disk-derived expectation the reconciler holds every BDD project to. */
export interface DiskScenarioCount {
  readonly total: number;
  readonly perFile: readonly FeatureScenarioCount[];
}

/**
 * Executable scenarios in one feature-file body: each plain `Scenario` counts
 * once, each `Scenario Outline` counts once per `Examples` data row (that is how
 * playwright-bdd instantiates it into specs), summed across `Rule`s too.
 *
 * @throws NonEnglishFeatureError when the file's dialect is not English.
 */
export function countScenariosInFeature(text: string, file: string): number {
  const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
  const feature = parser.parse(text).feature;
  if (!feature) return 0;
  if (feature.language !== ENGLISH_DIALECT) {
    throw new NonEnglishFeatureError(file, feature.language);
  }
  return countInChildren(feature.children);
}

function countInChildren(children: readonly (FeatureChild | RuleChild)[]): number {
  return children.reduce((total, child) => {
    if ('rule' in child && child.rule) return total + countInChildren(child.rule.children);
    if (child.scenario) return total + countScenario(child.scenario);
    return total;
  }, 0);
}

/**
 * A plain `Scenario` has no `Examples` and counts once; a `Scenario Outline`
 * carries `Examples` and counts one per data row (`tableBody`), never the header.
 */
function countScenario(scenario: Scenario): number {
  const examples = scenario.examples ?? [];
  if (examples.length === 0) return 1;
  return examples.reduce((rows, example) => rows + (example.tableBody?.length ?? 0), 0);
}

/**
 * Parses every `*.feature` under `dir` and totals their scenarios.
 *
 * @throws NonEnglishFeatureError on the first non-English file.
 */
export function countScenariosOnDisk(dir: string = E2E_FEATURES_DIR): DiskScenarioCount {
  const perFile = fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith(FEATURE_FILE_SUFFIX))
    .sort()
    .map((file) => ({
      file,
      scenarios: countScenariosInFeature(fs.readFileSync(path.join(dir, file), 'utf8'), file),
    }));
  return { total: perFile.reduce((sum, entry) => sum + entry.scenarios, 0), perFile };
}
