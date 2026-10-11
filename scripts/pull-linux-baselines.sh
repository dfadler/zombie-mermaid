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
  # test-results/<test-dir>/<name>-actual.png; the baseline path is derived from
  # the test dir (spec file + sample) so locate it by the spec's snapshot dir.
  base="$(basename "$actual" -actual.png)"
  spec="$(find "$dest" -name "${base}-chromium-linux.png" -print -quit)"
  if [[ -z "$spec" ]]; then
    echo "skip (no existing baseline, add by hand): $actual" >&2
    continue
  fi
  cp "$actual" "$spec"
  n=$((n + 1))
done < <(find "$tmp" -name '*-actual.png')
echo "updated $n baseline(s); review with git diff --stat"
