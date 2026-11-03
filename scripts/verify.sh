#!/usr/bin/env bash
# Fast local verify: typecheck (3 tsc projects in parallel), oxlint + oxfmt
# on files changed vs origin/main, then vitest on tests affected by the change.
# --full mirrors CI: whole-repo lint/format and test:coverage.
# --ci-gates adds the cheap deterministic CI gates that otherwise fail late:
# build + API-report match + bundle-size budget (~20s); --full includes them.
# The snapshot allow-list gate (~2s) always runs.
set -euo pipefail

usage() { echo "Usage: pnpm run verify [--full] [--ci-gates]  (BASE=<ref> overrides origin/main)"; }
full=0
gates=0
case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  --full) full=1; gates=1 ;;
  --ci-gates) gates=1 ;;
  "") ;;
  *) usage >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."
base="${BASE:-origin/main}"

# The Node >=24 guard (src/cli/node-guard.ts) makes every test importing src/cli.ts fail
# on older Node; say so up front, and again at exit so it is not lost in scrollback.
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$node_major" -lt 24 ]; then
  n=$(grep -rlE "(from|import\()\s*['\"][./]+(src/)?cli(\.ts)?['\"]" --include='*.test.ts' src __tests__ packages 2>/dev/null | wc -l | tr -d ' ' || true)
  node_msg="verify: Node $(node -v 2>/dev/null || echo none) detected, repo needs >=24 (see .nvmrc); $n CLI dispatch test files will fail"
  echo "$node_msg" >&2
  trap '[ $? -eq 0 ] || echo "$node_msg" >&2' EXIT
fi

scripts/check-snapshot-allowlist.sh

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
pnpm run --silent check:plugin-skill
pnpm run --silent check:plugin-lock

if [ "$gates" -eq 1 ]; then
  # Same commands as the CI build job: build, regenerate API reports (fail if etc/api
  # differs from what is committed), bundle-size budget.
  pnpm run build
  pnpm run api:report
  if [ -n "$(git status --porcelain -- etc/api)" ]; then
    echo "verify: public API surface changed: commit the etc/api/ diff" >&2
    exit 1
  fi
  pnpm run check:bundle-size
fi

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
  printf '%s\n' "$changed" | xargs pnpm exec oxfmt --check --no-error-on-unmatched-pattern
fi
pnpm exec vitest run -c config/vitest.config.ts --changed "$base"
