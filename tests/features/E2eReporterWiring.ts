import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static assertion that the e2e scenario-count reconciler is ARMED — the one
 * hole a runtime check cannot cover is its own wiring: a run configured without
 * the reporter has no reporter to complain, so a silently shrunk run would pass.
 *
 * Two facts, both read from source text (never by importing the config, which
 * would need Playwright and drag the host boot into `npm test`):
 *
 *  1. `scripts/run-e2e.sh` — the full `npm run test:e2e` — exports the arming
 *     env var before invoking Playwright.
 *  2. `e2e/playwright.config.ts` gates the reporter on that SAME env var and
 *     lists the reporter module in its `reporter` array.
 *
 * See docs-internal/bdd-testing-strategy.md, "Viewport routing" (the CONFIG side
 * is guarded by count reconciliation), and e2e/scenarioCountReporter.ts.
 */

/** The env var that arms the reporter. Must match the string in both files below. */
export const ARMING_ENV_VAR = 'E2E_RECONCILE_SCENARIO_COUNT';

/** The reporter module the config must reference, relative to the config dir. */
export const REPORTER_MODULE = './scenarioCountReporter.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN_SCRIPT = path.join('scripts', 'run-e2e.sh');
const CONFIG = path.join('e2e', 'playwright.config.ts');

/** One missing piece of the reporter's wiring, phrased as a fix. */
export interface WiringGap {
  /** Repo-relative file the gap is in. */
  readonly file: string;
  readonly problem: string;
}

/** Checks that the scenario-count reporter is wired into the full e2e run. */
export class E2eReporterWiring {
  constructor(private readonly repoRoot: string = REPO_ROOT) {}

  /** Every wiring gap found, empty when the reporter is fully armed. */
  gaps(): WiringGap[] {
    return [...this.runScriptGaps(), ...this.configGaps()];
  }

  private runScriptGaps(): WiringGap[] {
    const text = this.read(RUN_SCRIPT);
    // `export E2E_RECONCILE_SCENARIO_COUNT=...` — the arming must be exported so
    // the Playwright child process (and thus the config) can see it.
    const armed = new RegExp(`export\\s+${ARMING_ENV_VAR}=`).test(text);
    return armed
      ? []
      : [
          {
            file: RUN_SCRIPT,
            problem: `must \`export ${ARMING_ENV_VAR}=…\` before running Playwright, or the full e2e run leaves the scenario-count reconciler disarmed`,
          },
        ];
  }

  private configGaps(): WiringGap[] {
    const text = this.read(CONFIG);
    const gaps: WiringGap[] = [];
    if (!text.includes(ARMING_ENV_VAR)) {
      gaps.push({
        file: CONFIG,
        problem: `must gate the reporter on \`process.env.${ARMING_ENV_VAR}\` so it is off for ad-hoc subset runs`,
      });
    }
    if (!text.includes(REPORTER_MODULE)) {
      gaps.push({
        file: CONFIG,
        problem: `must list the reporter \`${REPORTER_MODULE}\` in its \`reporter\` array`,
      });
    }
    return gaps;
  }

  private read(repoRelative: string): string {
    return fs.readFileSync(path.join(this.repoRoot, repoRelative), 'utf8');
  }
}
