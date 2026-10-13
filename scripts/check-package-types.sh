#!/usr/bin/env bash
# Report-only publint + attw over packed tarballs (#1868). Usage:
#   check-package-types.sh <dir-of-tgz>   (default: pack into a temp dir)
# Exit 1 if any tool reports problems; CI runs it with continue-on-error.
set -uo pipefail
cd "$(dirname "$0")/.."
dir="${1:-}"
if [ -z "$dir" ]; then
  dir="$(mktemp -d)"
  SMOKE_TARBALL_DIR="$dir" node scripts/smoke-test-packed.mjs >/dev/null || exit 2
fi
rc=0
shopt -s nullglob
for t in "$dir"/*.tgz; do
  echo "=== $(basename "$t") ==="
  pnpm exec publint run "$t" --strict || rc=1
  pnpm exec attw "$t" --profile node16 --format table-flipped || rc=1
done
exit $rc
