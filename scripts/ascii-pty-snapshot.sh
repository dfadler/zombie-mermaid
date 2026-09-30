#!/usr/bin/env bash
# PROPOSAL (zombie-mermaid#1151, Option B; see
# docs/decisions/ascii-pty-snapshot-suite-1151.md). Not wired into required
# CI. Prototype of a real-PTY snapshot check for ASCII rendering.
#
# For each sample in scripts/ascii-pty-snapshot-samples.txt, runs
# scripts/ascii-terminal-capture.sh (real PTY via asciinema, rasterized by
# agg's Docker image) and compares the result against committed goldens in
# __tests__/ascii-pty-snapshots/:
#   <slug>.txt  terminal text as recorded through the PTY: compared exactly.
#   <slug>.png  rasterized screenshot: compared with a pixel tolerance.
# Comparing both separates the two failure classes: a .txt diff means the
# renderer's output changed; a .png-only diff means rasterization/font drift.
#
# Usage: scripts/ascii-pty-snapshot.sh [--update] [--samples FILE] [--golden-dir DIR] [--out-dir DIR]
set -uo pipefail

EXIT_OK=0
EXIT_FAILURE=1
EXIT_USAGE=2
EXIT_DEPENDENCY=4

# Pinned by digest so a new agg release (or its font package) cannot change
# pixels without a reviewed commit here. Bump deliberately, then --update.
DEFAULT_AGG_IMAGE='ghcr.io/asciinema/agg@sha256:84e04c21013e4fb91cbdb3eade5977c1e66685c18f0d234da78d3350bb3404b2'

# Max fraction of pixels allowed to differ (per-channel delta > PIXEL_DELTA)
# before a .png is reported as changed.
MAX_DIFF_FRACTION="${ASCII_PTY_MAX_DIFF_FRACTION:-0.001}"
PIXEL_DELTA=8

usage() {
  cat <<'USAGE'
Usage: scripts/ascii-pty-snapshot.sh [--update] [--samples FILE] [--golden-dir DIR] [--out-dir DIR]

PROPOSAL (#1151 Option B): capture each curated sample through a real PTY
and compare with committed goldens. Requires asciinema, docker, python3 with
Pillow, and `pnpm install` (see scripts/ascii-terminal-capture.sh --help).

  --update       Write/overwrite goldens instead of comparing.
  --samples F    Sample list (default scripts/ascii-pty-snapshot-samples.txt).
  --golden-dir D Golden directory (default __tests__/ascii-pty-snapshots).
  --out-dir D    Where fresh captures and diff images go (default: a temp dir).

Exit codes: 0 all match (or --update done); 1 at least one sample differs;
2 usage error; 4 missing dependency or a capture failed.
Environment: ASCII_AGG_DOCKER_IMAGE overrides the digest-pinned agg image;
ASCII_PTY_MAX_DIFF_FRACTION overrides the png tolerance (default 0.001).
USAGE
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
samples_file="$repo_root/scripts/ascii-pty-snapshot-samples.txt"
golden_dir="$repo_root/__tests__/ascii-pty-snapshots"
out_dir=""
update=0

while [ "$#" -gt 0 ]; do
  case "$1" in
  -h | --help)
    usage
    exit "$EXIT_OK"
    ;;
  --update) update=1 ;;
  --samples | --golden-dir | --out-dir)
    if [ "$#" -lt 2 ]; then
      echo "$1 needs a value" >&2
      exit "$EXIT_USAGE"
    fi
    case "$1" in
    --samples) samples_file="$2" ;;
    --golden-dir) golden_dir="$2" ;;
    --out-dir) out_dir="$2" ;;
    esac
    shift
    ;;
  *)
    echo "unknown argument: $1" >&2
    usage >&2
    exit "$EXIT_USAGE"
    ;;
  esac
  shift
done

if [ ! -f "$samples_file" ]; then
  echo "sample list not found: $samples_file" >&2
  exit "$EXIT_USAGE"
fi
if ! python3 -c 'import PIL' >/dev/null 2>&1; then
  echo "missing dependency: python3 Pillow (pip3 install pillow)" >&2
  exit "$EXIT_DEPENDENCY"
fi

if [ -z "$out_dir" ]; then
  out_dir="$(mktemp -d)"
else
  mkdir -p "$out_dir"
fi
mkdir -p "$golden_dir"

export ASCII_AGG_RUNTIME=docker
export ASCII_AGG_DOCKER_IMAGE="${ASCII_AGG_DOCKER_IMAGE:-$DEFAULT_AGG_IMAGE}"
# Deterministic PTY environment: the renderer's color-mode detection reads
# these, and a developer's shell may set different values than CI's.
export TERM=xterm-256color COLORTERM=truecolor
unset NO_COLOR FORCE_COLOR

# Compare two PNGs; prints the differing-pixel fraction, or "size-mismatch".
# Writes <diff-out> (changed pixels in red) when they differ.
png_diff() {
  python3 - "$1" "$2" "$3" "$PIXEL_DELTA" <<'PY'
import sys
from PIL import Image, ImageChops

golden, fresh, diff_out, delta = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
a = Image.open(golden).convert("RGB")
b = Image.open(fresh).convert("RGB")
if a.size != b.size:
    print("size-mismatch")
    sys.exit(0)
mask = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > delta else 0)
changed = mask.histogram()[255]
frac = changed / (a.width * a.height)
if changed:
    red = Image.new("RGB", a.size, (255, 0, 0))
    Image.composite(red, b, mask).save(diff_out)
print(f"{frac:.6f}")
PY
}

failed=0
total=0
while IFS= read -r line; do
  case "$line" in '' | '#'*) continue ;; esac
  index="${line%% :: *}"
  rest="${line#* :: }"
  title="${rest%% :: *}"
  total=$((total + 1))
  slug="$(printf '%s-%s' "$index" "$title" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
  prefix="$out_dir/$slug"
  if ! "$repo_root/scripts/ascii-terminal-capture.sh" "$repo_root/src/index.ts" "$index" "$prefix" >"$prefix.log" 2>&1; then
    echo "CAPTURE-FAILED $slug (see $prefix.log)" >&2
    tail -n 5 "$prefix.log" >&2
    exit "$EXIT_DEPENDENCY"
  fi
  if [ "$update" -eq 1 ]; then
    cp "$prefix.txt" "$golden_dir/$slug.txt"
    cp "$prefix.png" "$golden_dir/$slug.png"
    echo "UPDATED $slug"
    continue
  fi
  if [ ! -f "$golden_dir/$slug.txt" ] || [ ! -f "$golden_dir/$slug.png" ]; then
    echo "MISSING-GOLDEN $slug (run with --update)"
    failed=$((failed + 1))
    continue
  fi
  status=''
  if ! diff -u "$golden_dir/$slug.txt" "$prefix.txt" >"$prefix.txt.diff"; then
    status="TEXT-DIFF (renderer output changed; see $prefix.txt.diff)"
  fi
  frac="$(png_diff "$golden_dir/$slug.png" "$prefix.png" "$prefix.diff.png")"
  if [ "$frac" = size-mismatch ]; then
    status="$status PNG-SIZE-MISMATCH"
  elif awk -v f="$frac" -v m="$MAX_DIFF_FRACTION" 'BEGIN { exit !(f > m) }'; then
    status="$status PNG-DIFF ${frac} (see $prefix.diff.png)"
  fi
  if [ -z "$status" ]; then
    echo "ok $slug (png diff fraction $frac)"
  else
    echo "CHANGED $slug: $status"
    failed=$((failed + 1))
  fi
done <"$samples_file"

if [ "$update" -eq 1 ]; then
  echo "updated $total samples in $golden_dir"
  exit "$EXIT_OK"
fi
echo "$((total - failed))/$total samples match; captures in $out_dir"
if [ "$failed" -gt 0 ]; then
  exit "$EXIT_FAILURE"
fi
exit "$EXIT_OK"
