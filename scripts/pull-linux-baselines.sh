#!/usr/bin/env bash
# Pull the Linux screenshots a failed CI Visual run produced and install them as
# the new baselines (the `*-actual.png` files in the failure artifacts).
# Usage: scripts/pull-linux-baselines.sh <run-id>
# Review the resulting PNG diffs before committing. See #1577.
set -euo pipefail

if [[ $# -ne 1 || "$1" == -h || "$1" == --help ]]; then
  echo "Usage: ${0##*/} <run-id>  (installs -actual.png from visual-regression-failures-* as -linux baselines)"
  [[ $# -eq 1 ]] && exit 0 || exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

gh run download "$1" -p 'visual-regression-failures-*' -D "$tmp"

dest="$repo_root/__tests__/visual/__screenshots__"
n=0
while IFS= read -r actual; do
  # test-results/<test-dir>/<name>-actual.png. Playwright names <test-dir>
  # "<spec-stem>.visual-<sample>-<hash>-<project>", e.g. "ascii-samples.visual-xycha-...",
  # which maps to __screenshots__/<spec-stem>.visual.test.ts/. Install only there:
  # the same baseline name can exist in several spec dirs (#1744).
  testdir="$(basename "$(dirname "$actual")")"
  if [[ "$testdir" != *.visual-* ]]; then
    echo "skip (cannot map test dir to a spec): $actual" >&2
    continue
  fi
  spec_dir="$dest/${testdir%%.visual-*}.visual.test.ts"
  spec="$spec_dir/$(basename "$actual" -actual.png)-chromium-linux.png"
  if [[ ! -f "$spec" ]]; then
    echo "skip (no existing baseline in ${spec_dir##*/}, add by hand): $actual" >&2
    continue
  fi
  cp "$actual" "$spec"
  n=$((n + 1))
done < <(find "$tmp" -name '*-actual.png')
echo "updated $n baseline(s); review with git diff --stat"
