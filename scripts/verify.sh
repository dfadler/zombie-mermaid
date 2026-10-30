#!/usr/bin/env bash
# Fast local verify: typecheck (3 tsc projects in parallel), oxlint + oxfmt
# on files changed vs origin/main, then vitest on tests affected by the change.
# --full mirrors CI: whole-repo lint/format and test:coverage.
set -euo pipefail

usage() { echo "Usage: pnpm run verify [--full]  (BASE=<ref> overrides origin/main)"; }
full=0
case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  --full) full=1 ;;
  "") ;;
  *) usage >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."
base="${BASE:-origin/main}"

pids=()
for p in tsconfig.json demo/tsconfig.json editor/tsconfig.json; do
  info="node_modules/.cache/verify-${p//\//-}.tsbuildinfo"
  pnpm exec tsc --noEmit -p "$p" --incremental --tsBuildInfoFile "$info" &
  pids+=($!)
done
tsc_fail=0
for pid in "${pids[@]}"; do wait "$pid" || tsc_fail=1; done
[ "$tsc_fail" -eq 0 ] || { echo "verify: typecheck failed" >&2; exit 1; }

pnpm run --silent check:changesets

if [ "$full" -eq 1 ]; then
  pnpm run lint
  pnpm run format:check
  pnpm run test:coverage
  exit 0
fi

# Changed, still-existing files (committed vs base, plus uncommitted and untracked).
changed=$( { git diff --name-only --diff-filter=d "$base"...HEAD; git diff --name-only --diff-filter=d HEAD; git ls-files --others --exclude-standard; } | sort -u)
lintable=$(printf '%s\n' "$changed" | grep -E '\.(ts|tsx|js|mjs|cjs)$' || true)
if [ -n "$lintable" ]; then
  printf '%s\n' "$lintable" | xargs pnpm exec oxlint --report-unused-disable-directives-severity=error
fi
if [ -n "$changed" ]; then
  printf '%s\n' "$changed" | xargs pnpm exec oxfmt --check
fi
pnpm exec vitest run -c config/vitest.config.ts --changed "$base"
