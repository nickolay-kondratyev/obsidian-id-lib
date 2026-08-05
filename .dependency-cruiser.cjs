// Import-boundary enforcement for the domain layer.
//
// WHY: docs-internal/bdd-testing-strategy.md ("Domain isolation via adapters" +
// "Enforcement") requires domain source and the domain-tier step definitions to
// consume narrow, domain-owned adapter interfaces instead of the host API — and
// requires that to be enforced in CI rather than by convention.
//
// The ban includes TYPE-ONLY imports (`import type { TFile } from 'obsidian'`):
// they are erased at runtime but still couple domain signatures to the host's
// vocabulary. `tsPreCompilationDeps: true` below is what makes them visible;
// without it the rule silently passes on the imports that matter most.
//
// The single sanctioned host-API bridgehead is `src/obsidian/` — the adapter
// implementations that translate between Obsidian's Vault/TFile and the
// domain's own types (see src/DocFile.ts).

/** Everything outside the sanctioned host-API adapter directory. */
const DOMAIN_SOURCE = {
	path: '^(src|tests/domain)/',
	pathNot: '^src/obsidian/',
};

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: 'domain-no-obsidian',
			severity: 'error',
			comment:
				"Domain source must not import 'obsidian' (type-only imports included). " +
				'Depend on a domain-owned adapter interface instead (src/DocFile.ts, ' +
				'src/FileContentAccess.ts) and put the Obsidian-backed implementation in src/obsidian/.',
			from: DOMAIN_SOURCE,
			// Two shapes on purpose: the 'obsidian' package ships type
			// declarations only, so its main entry does not resolve to a file and
			// dependency-cruiser reports the bare module name. The node_modules
			// form keeps the rule correct if that ever changes.
			to: { path: '^obsidian$|node_modules/obsidian/' },
		},
		{
			name: 'domain-no-playwright',
			severity: 'error',
			comment:
				'Domain source and the domain BDD tier must not import Playwright — ' +
				'the domain tier runs in vitest against fakes; Playwright belongs to e2e/.',
			from: DOMAIN_SOURCE,
			to: {
				path: '^(@playwright/test|playwright|playwright-bdd)$|node_modules/(@playwright|playwright|playwright-bdd)/',
			},
		},
	],
	options: {
		// Sees `import type` / type-position-only imports — without this the
		// host-API ban would miss exactly the imports it exists to catch.
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.json' },
		// Report the edge into node_modules, but do not crawl its graph.
		doNotFollow: { path: 'node_modules' },
		// e2e/ drives the REAL Obsidian on purpose and has its own tsconfig;
		// dist/ is build output.
		exclude: { path: '^(e2e|dist)/' },
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			conditionNames: ['import', 'require', 'node', 'default', 'types'],
			extensions: ['.ts', '.js', '.mjs', '.cjs'],
		},
	},
};
