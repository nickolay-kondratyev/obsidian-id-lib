import { describe, expect, it } from 'vitest';
import {
  DomainImportBoundaryProbe,
  FIXTURE_SOURCE,
} from './DomainImportBoundaryProbe';

/**
 * Tripwire for the domain import boundary (`.dependency-cruiser.cjs`,
 * `check:boundaries`). The rule's job is to reject host-API imports from domain
 * source — INCLUDING type-only ones, which are erased at runtime yet still
 * couple domain signatures to Obsidian's vocabulary. That "type-only counts"
 * teeth is exactly what a config-shape assertion can't prove and what silently
 * rots if `tsPreCompilationDeps` is dropped, so it is exercised for real here.
 *
 * See DomainImportBoundaryProbe.ts for how a genuinely-violating fixture is run
 * without turning the everyday `depcruise src tests` red.
 */
describe('domain import-boundary rule (domain-no-obsidian)', () => {
  const probe = new DomainImportBoundaryProbe();

  it('flags a TYPE-ONLY host import in domain-shaped source', async () => {
    const violations = await probe.violationsFor(
      "import type { TFile } from 'obsidian';\nexport type Probe = TFile;\n",
    );

    expect(violations).toEqual([
      { from: FIXTURE_SOURCE, to: 'obsidian', rule: 'domain-no-obsidian' },
    ]);
  });

  // The control: proves the probe reports ABSENCE too, so the assertion above
  // is the host import being caught — not a harness that always fails.
  it('leaves domain-shaped source with no host import alone', async () => {
    const violations = await probe.violationsFor(
      'export interface Probe {\n  readonly path: string;\n}\n',
    );

    expect(violations).toEqual([]);
  });
});
