import * as path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { NonEnglishFeatureError, countScenariosOnDisk } from './scenarioCount';

/**
 * Reconciles the e2e BDD scenarios that ACTUALLY EXECUTED against the count
 * derived from parsing `features/e2e/` on disk (scenarioCount.ts), and fails the
 * run on any mismatch. This is the CONFIG-side guard the static tag audit cannot
 * give: a narrowed `features` glob, an added `grep`, a changed `testDir`, a
 * dropped project, or a scenario skipped at runtime all leave the tag audit
 * green while silently shrinking the run. See docs-internal/bdd-testing-strategy.md,
 * "Viewport routing".
 *
 * It is armed ONLY on the full `npm run test:e2e` (scripts/run-e2e.sh sets the
 * env var the config gates this reporter on): an ad-hoc subset run is MEANT to
 * run less, and a check that cries wolf there gets ignored on the run that
 * matters. Its own arming — the env var in the script and the reporter line in
 * the config — is asserted statically in `npm test` (tests/features/), since a
 * run configured without the reporter has no reporter to complain.
 *
 * A BDD project is identified STRUCTURALLY: the playwright-bdd `testDir` (the
 * generated-spec directory) is handed in via options and matched against each
 * project that ran, so a project renamed or dropped needs no edit here and a
 * dropped project surfaces as "no BDD project ran".
 */

/** Reporter options set in playwright.config.ts. */
export interface ScenarioCountReporterOptions {
  /** The `defineBddConfig` output dir — a project whose `testDir` is this is a BDD tier. */
  readonly bddTestDir: string;
}

/** One BDD project and how its executed scenario count compares to disk. */
interface ProjectReconciliation {
  readonly project: string;
  readonly executed: number;
}

export default class ScenarioCountReporter implements Reporter {
  private readonly bddTestDir: string;
  private readonly executedByProject = new Map<string, number>();
  private bddProjectNames: readonly string[] = [];

  constructor(options: ScenarioCountReporterOptions) {
    this.bddTestDir = path.resolve(options.bddTestDir);
  }

  printsToStdio(): boolean {
    return true;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    // Only projects that actually ran appear under the root suite, so a project
    // filtered out by `--project` or dropped from the config is simply absent
    // here — which the disk reconciliation below then catches as a shortfall.
    this.bddProjectNames = suite.suites
      .filter((projectSuite) => this.isBddProject(projectSuite))
      .map((projectSuite) => projectSuite.project()!.name);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = projectNameOf(test);
    // A scenario skipped at RUNTIME did not execute — excluding it here is what
    // lets the reconciliation catch a `test.skip()` slipped into a step.
    if (project === undefined || result.status === 'skipped') return;
    this.executedByProject.set(project, (this.executedByProject.get(project) ?? 0) + 1);
  }

  async onEnd(_result: FullResult): Promise<{ status: FullResult['status'] } | void> {
    let expected: number;
    try {
      expected = countScenariosOnDisk().total;
    } catch (error) {
      if (error instanceof NonEnglishFeatureError) return this.fail([error.message]);
      throw error;
    }

    const problems = this.reconcile(expected);
    if (problems.length > 0) return this.fail(problems);
  }

  /** True when this ran-project is a playwright-bdd tier (its testDir is the generated dir). */
  private isBddProject(projectSuite: Suite): boolean {
    const project = projectSuite.project();
    return project !== undefined && path.resolve(project.testDir) === this.bddTestDir;
  }

  /** Human-readable shortfalls, empty when every BDD project ran all scenarios. */
  private reconcile(expected: number): string[] {
    if (this.bddProjectNames.length === 0) {
      return [
        `No BDD project ran: expected a project whose testDir is the playwright-bdd ` +
          `generated dir (${this.bddTestDir}). A dropped or filtered-out BDD project ` +
          `is exactly the silent shrink this guard exists to catch.`,
      ];
    }
    return this.bddProjectNames
      .map((project) => ({ project, executed: this.executedByProject.get(project) ?? 0 }))
      .filter((reconciliation) => reconciliation.executed !== expected)
      .map((reconciliation) => describeShortfall(reconciliation, expected));
  }

  /** Prints the problems with fix guidance and marks the whole run failed. */
  private fail(problems: readonly string[]): { status: 'failed' } {
    const forwarded = forwardedFilters();
    const lines = [
      '',
      'E2E SCENARIO COUNT RECONCILIATION FAILED',
      ...problems.map((problem) => `  - ${problem}`),
      '',
      'The e2e BDD tier must EXECUTE every scenario under features/e2e/. A mismatch',
      'means the run was narrowed (a shrunk `features` glob, an added grep, a changed',
      'testDir, a dropped project, or a runtime skip) rather than the disk truth.',
    ];
    if (forwarded.length > 0) {
      lines.push(
        '',
        `Filters were forwarded to this run: ${forwarded.join(' ')}`,
        'Forwarded filters (e.g. `npm run test:e2e -- --project bdd`, `-- --grep X`,',
        '`-- some.feature`) narrow the run and trip this check on purpose — a',
        'self-narrowed run is indistinguishable from a config that dropped a project.',
        'Re-run the full `npm run test:e2e` with no extra arguments to reconcile.',
      );
    }
    // eslint-disable-next-line no-console -- a reporter's job is to print to the run's stdio.
    console.error(lines.join('\n'));
    return { status: 'failed' };
  }
}

function describeShortfall(reconciliation: ProjectReconciliation, expected: number): string {
  const { project, executed } = reconciliation;
  const verb = executed < expected ? 'only ' : '';
  return (
    `Project "${project}" executed ${verb}${executed} scenario(s), but features/e2e/ ` +
    `on disk defines ${expected}.`
  );
}

/** Walks up a test's suite chain to the project suite and returns its name. */
function projectNameOf(test: TestCase): string | undefined {
  for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
    const project = suite.project();
    if (project !== undefined) return project.name;
  }
  return undefined;
}

/**
 * The filtering args forwarded to `npm run test:e2e -- …` (everything after the
 * `--config <file>` pair the script itself adds), so the failure can name them.
 */
function forwardedFilters(): string[] {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const scriptArgs = configFlag === -1 ? args : args.slice(configFlag + 2);
  return scriptArgs.filter((arg) => arg.length > 0);
}
