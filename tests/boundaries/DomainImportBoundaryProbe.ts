import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { cruise } from 'dependency-cruiser';
import type { IConfiguration, ICruiseOptions } from 'dependency-cruiser';

/**
 * Runs the repo's OWN import-boundary rule against a throwaway fixture, so a
 * type-only host import in domain-shaped source can be proven to actually
 * trip it.
 *
 * WHY this can't be a `depcruise src tests` assertion: the everyday boundary
 * check (`check:boundaries`) scans the real trees and must stay green, so a
 * fixture that genuinely violates the rule cannot live under `src/` or
 * `tests/domain/`. This probe instead cruises a fixture written under `.tmp/`
 * (which the everyday check never scans) and remaps its path back to `src/`
 * via `baseDir`, so the REAL rule's `from: ^(src|tests/domain)/` still applies.
 *
 * WHY it loads `.dependency-cruiser.cjs` rather than restating the rule: the
 * whole point is to hold the SHIPPED rule to account, teeth and all —
 * `options.tsPreCompilationDeps` (without which type-only imports are invisible)
 * and `forbidden[].to.path` (which must keep matching the bare `obsidian`
 * module name the types-only package resolves to). Restating any of that would
 * test a copy and let the original rot. The only things added here are the
 * invocation scaffolding the `depcruise` CLI itself adds: `validate: true`
 * (turns rule checking on) and `baseDir`.
 *
 * WHY-NOT feed cruise the parsed tsconfig too (the CLI does): a self-contained
 * `import type` fixture is detected by `tsPreCompilationDeps` under the TS
 * compiler's defaults, and pulling in `extract-ts-config` means a package
 * subpath that this repo's `moduleResolution: node` can't type-check. The
 * load-bearing flag itself still rides in via `...options`.
 *
 * See docs-internal/bdd-testing-strategy.md ("Domain isolation via adapters")
 * and the header of .dependency-cruiser.cjs.
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const CONFIG_PATH = path.join(REPO_ROOT, '.dependency-cruiser.cjs');

/** Gitignored scratch root — never scanned by `depcruise src tests`. */
const SCRATCH_DIR = path.join(REPO_ROOT, '.tmp');

/**
 * The fixture's basename inside its temp `src/`. The reported module path is
 * `src/<this>`, which is what the rule's `from` pattern is asserted against.
 */
const FIXTURE_BASENAME = 'DomainProbe.ts';

/** The reported source path a fixture takes on once remapped via `baseDir`. */
export const FIXTURE_SOURCE = `src/${FIXTURE_BASENAME}`;

/** One import-boundary rule violation, flattened to what the test asserts on. */
export interface BoundaryViolation {
  /** Reporting module path, e.g. `src/DomainProbe.ts`. */
  readonly from: string;
  /** The offending import target, e.g. `obsidian`. */
  readonly to: string;
  /** The name of the rule that fired, e.g. `domain-no-obsidian`. */
  readonly rule: string;
}

/** Cruises single-file fixtures through the repo's real boundary rules. */
export class DomainImportBoundaryProbe {
  private readonly config: IConfiguration = createRequire(
    pathToFileURL(CONFIG_PATH).href,
  )(CONFIG_PATH) as IConfiguration;

  constructor(private readonly scratchDir: string = SCRATCH_DIR) {}

  /**
   * Writes `fixtureBody` as `src/DomainProbe.ts` in a throwaway root and cruises
   * it with the repo's real forbidden rules, returning every violation found.
   */
  async violationsFor(fixtureBody: string): Promise<BoundaryViolation[]> {
    fs.mkdirSync(this.scratchDir, { recursive: true });
    const fixtureRoot = fs.mkdtempSync(
      path.join(this.scratchDir, 'boundary-probe-'),
    );
    try {
      const sourceDir = path.join(fixtureRoot, 'src');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, FIXTURE_BASENAME), fixtureBody);
      // `return await`, not bare `return`: the fixture must survive until the
      // cruise has finished reading it, so `finally` has to wait on the promise.
      return await this.cruiseFixtureRoot(fixtureRoot);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }

  private async cruiseFixtureRoot(
    fixtureRoot: string,
  ): Promise<BoundaryViolation[]> {
    const cruiseOptions: ICruiseOptions = {
      ...this.config.options,
      ruleSet: { forbidden: this.config.forbidden },
      // `baseDir` remaps the fixture back onto `src/…` so the real rule's `from`
      // matches; `validate` is what turns rule checking on at all (the CLI sets
      // it whenever a rule set is present).
      baseDir: fixtureRoot,
      validate: true,
      outputType: 'json',
    };

    const { output } = await cruise(['src'], cruiseOptions);

    const result = JSON.parse(output as string) as {
      summary: {
        violations: {
          from: string;
          to: string;
          rule: { name: string };
        }[];
      };
    };

    return result.summary.violations.map((violation) => ({
      from: violation.from,
      to: violation.to,
      rule: violation.rule.name,
    }));
  }
}
