#!/usr/bin/env bash
# Release obsidian-id-lib to https://www.npmjs.com/package/obsidian-id-lib.
#
#   ./release_to_npm_with_version_bump.sh            # patch bump (default)
#   ./release_to_npm_with_version_bump.sh minor
#   ./release_to_npm_with_version_bump.sh 1.2.3      # explicit version
#
# Order of operations (deliberate): the FULL test suite runs BEFORE anything is
# mutated, so a red suite leaves the repo and the registry untouched. Only then
# is the version bumped, committed, tagged and pushed to the default branch —
# npm refuses to re-publish a version, so the pushed commit is what the
# published tarball was built from.
#
# Auth: `.npmrc` reads the registry token from ${NPM_PUBLISH_TOKEN}; this script
# only checks that it is set. Full runbook: docs-internal/how-to-publish-to-npm.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${REPO_ROOT}"

BUMP="${1:-patch}"

fail() {
	echo "release: $*" >&2
	exit 1
}

# --- Preconditions: everything that can be checked without side effects -------

if [[ -z "${NPM_PUBLISH_TOKEN:-}" ]]; then
	fail "NPM_PUBLISH_TOKEN is not set — .npmrc needs it to authenticate the publish."
fi

# `git symbolic-ref refs/remotes/origin/HEAD` is the locally recorded default
# branch; it is absent in clones made without it, hence the `main` fallback.
DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ "${CURRENT_BRANCH}" != "${DEFAULT_BRANCH}" ]]; then
	fail "releases happen on the default branch: on=[${CURRENT_BRANCH}] expected=[${DEFAULT_BRANCH}]"
fi

if [[ -n "$(git status --porcelain)" ]]; then
	fail "working tree is dirty — commit or stash first (the release commit must contain only the version bump)."
fi

git fetch origin "${DEFAULT_BRANCH}"
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/${DEFAULT_BRANCH}")" ]]; then
	fail "local ${DEFAULT_BRANCH} differs from origin/${DEFAULT_BRANCH} — pull/push first."
fi

# --- Gate: every tier (types, unit, domain BDD, real-Obsidian e2e) ------------

echo "release: running the full test suite (npm run test:all)…"
npm run test:all

# --- Mutations ---------------------------------------------------------------

echo "release: bumping version: bump=[${BUMP}]"
# `npm version` writes package.json + package-lock.json, commits and tags.
npm version "${BUMP}" -m "chore(release): v%s"

NEW_VERSION="$(node -p "require('./package.json').version")"

echo "release: pushing release commit and tag: version=[v${NEW_VERSION}]"
git push --follow-tags origin "${DEFAULT_BRANCH}"

# `prepack` rebuilds dist/ from this exact commit before the tarball is made.
echo "release: publishing to npm: version=[v${NEW_VERSION}]"
npm publish

echo "release: published obsidian-id-lib@${NEW_VERSION}"
