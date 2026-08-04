#!/usr/bin/env bash
# Entry point for the Playwright e2e suite (`npm run test:e2e`).
#
# Ensures a real Obsidian binary is available before running: when OBSIDIAN_PATH
# is unset it auto-downloads a pinned build via setup-obsidian-bin.sh (Linux /
# Docker); an already-set OBSIDIAN_PATH is honoured untouched. Then type-checks
# the specs, builds the fixture host plugin that exposes the library to the real
# app, and runs Playwright. Extra args pass through, e.g.
#   npm run test:e2e -- docId.e2e.ts
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

if [[ -z "${OBSIDIAN_PATH:-}" ]]; then
	OBSIDIAN_PATH="$(bash scripts/setup-obsidian-bin.sh)"
	export OBSIDIAN_PATH
fi

# Headless environments (Docker / CI) have no display server, so Electron must
# render via Chromium's offscreen Ozone backend or it dies on boot ("Missing X
# server or $DISPLAY"). Default those flags when NO display is detected; an
# explicit OBSIDIAN_E2E_EXTRA_ARGS always wins (override for a real/GPU display).
if [[ -z "${OBSIDIAN_E2E_EXTRA_ARGS:-}" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
	export OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"
	echo "run-e2e: no display detected — using headless Obsidian flags: ${OBSIDIAN_E2E_EXTRA_ARGS}" >&2
fi

npm run check:e2e
node e2e/fixtures/host-plugin/build.mjs

exec npx playwright test --config e2e/playwright.config.ts "$@"
