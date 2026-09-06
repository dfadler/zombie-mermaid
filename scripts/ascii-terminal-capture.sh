#!/usr/bin/env bash
# Renders one Mermaid ASCII sample through a real PTY and produces:
#   <prefix>.cast  - the raw asciicast recording (ground truth)
#   <prefix>.txt   - plain-text export, for diffing before vs. after
#   <prefix>.png   - a rasterized terminal screenshot, auto-cropped to
#                    content, suitable for attaching to a PR/issue
#
# Backs the `verify-ascii-terminal` skill: a PR/issue touching ASCII
# rendering must show a real terminal, not scripts/visual-diff.ts's or the
# Playwright suite's browser/HTML approximation of one (ascii-html.ts) - see
# that skill for why the distinction matters and this repo's CLAUDE.md for
# when to invoke it.
#
# Usage: scripts/ascii-terminal-capture.sh <index-module-path> <sample-index-or-file> <output-prefix> [cols] [rows]
set -euo pipefail

EXIT_OK=0
EXIT_FAILURE=1
EXIT_USAGE=2
EXIT_DEPENDENCY=4

# Floor for the recording PTY when [cols]/[rows] aren't given. The actual
# default is max(floor, the size this sample renders at + SIZE_MARGIN), so a
# tall or wide sample is never clipped by an arbitrary fixed default - 39 of
# the 90 catalog samples exceed a stock 80x24 terminal, and several exceed
# this floor (see issue #483 for the clipped PR screenshots that motivated
# this).
DEFAULT_MIN_COLS=100
DEFAULT_MIN_ROWS=40
SIZE_MARGIN=2

usage() {
  cat <<'EOF'
Usage: scripts/ascii-terminal-capture.sh <index-module-path> <sample-index-or-file> <output-prefix> [cols] [rows]

Renders a Mermaid ASCII sample through a real PTY (via asciinema + agg, no
GUI window) and writes <output-prefix>.cast, .txt, and .png.

  <index-module-path>     Path to a src/index.ts exporting renderMermaidASCII
                           - the working tree's own, or a base ref's src/
                           extracted via `git archive <ref> src | tar -x -C <dir>`.
  <sample-index-or-file>  Numeric index into the working tree's
                           samples-data.ts, or a path to a .mmd file.
  <output-prefix>         Output path prefix, e.g. /tmp/after -> /tmp/after.cast, .txt, .png
  [cols] [rows]           Terminal size in character cells. Each defaults to
                           whichever is larger: 100x40, or the size this
                           sample actually renders at plus a 2-cell margin -
                           so nothing is clipped unless you pass a smaller
                           size explicitly (which prints a warning).

After recording, the .cast header's terminal size is checked against the
requested size and the script fails (exit 4) on a mismatch: asciinema
silently ignores a size flag it doesn't recognize (2.x took --cols/--rows,
3.x takes --window-size COLSxROWS) rather than erroring, which once shipped
PR screenshots clipped to 80x24 (issue #483). The flag form is detected from
`asciinema record --help` before recording, so both versions work.

Exit codes: 0 ok; 1 the sample failed to render; 2 usage error; 4 a missing
or misbehaving dependency (asciinema, agg, python3, tsx, or a recorded
terminal size that doesn't match the requested one).

Example (before/after a change, comparing against main):
  mkdir -p tmp-base-ref
  git archive main src | tar -x -C tmp-base-ref
  scripts/ascii-terminal-capture.sh ./src/index.ts 12 /tmp/after
  scripts/ascii-terminal-capture.sh ./tmp-base-ref/src/index.ts 12 /tmp/before
  diff /tmp/before.txt /tmp/after.txt

Requires (install once): brew install asciinema agg && pip3 install pillow
Also install the first font in the --font-family list below (e.g.
brew install --cask font-jetbrains-mono) - a missing font falls back
silently to the next one with no error, and can produce subtle
box-drawing glyph artifacts (e.g. a notched "┬") rather than an
obvious failure.
EOF
}

case "${1:-}" in
-h | --help)
  usage
  exit "$EXIT_OK"
  ;;
esac

if [ "$#" -lt 3 ]; then
  usage >&2
  exit "$EXIT_USAGE"
fi

index_module_path="$1"
sample_arg="$2"
out_prefix="$3"
cols_arg="${4:-}"
rows_arg="${5:-}"

for dim in "$cols_arg" "$rows_arg"; do
  if [ -n "$dim" ] && ! [[ "$dim" =~ ^[1-9][0-9]*$ ]]; then
    echo "invalid terminal size '$dim': [cols] and [rows] must be positive integers" >&2
    exit "$EXIT_USAGE"
  fi
done

for cmd in asciinema agg python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing dependency: $cmd (see --help for install instructions)" >&2
    exit "$EXIT_DEPENDENCY"
  fi
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="$script_dir/ascii-render-runner.mjs"

repo_root="$(cd "$script_dir/.." && pwd)"
tsx="$repo_root/node_modules/.bin/tsx"
if [ ! -x "$tsx" ]; then
  echo "missing dependency: tsx (run 'pnpm install' in $repo_root first)" >&2
  exit "$EXIT_DEPENDENCY"
fi

# asciinema renamed its size flags between major versions (2.x: --cols N
# --rows M; 3.x: --window-size NxM) and silently ignores whichever form it
# doesn't recognize - the recording just lands at the PTY's default 80x24.
# Detect the supported form from --help rather than assuming one, and refuse
# to record at all if neither is listed: a wrong-sized recording is worse
# than no recording, since it looks like a finished screenshot.
asciinema_version="$(asciinema --version 2>/dev/null || echo 'asciinema (unknown version)')"
record_help="$(asciinema record --help 2>&1 || true)"
if grep -qF -- '--window-size' <<<"$record_help"; then
  size_flag_form=window-size
elif grep -qF -- '--cols' <<<"$record_help" && grep -qF -- '--rows' <<<"$record_help"; then
  size_flag_form='cols-rows'
else
  echo "unsupported $asciinema_version: 'asciinema record --help' lists neither --window-size nor --cols/--rows, so the recording size can't be set" >&2
  exit "$EXIT_DEPENDENCY"
fi

# Measure the sample first (outside the PTY, colors off) so the recording
# terminal can be sized to fit it. This renders through the same
# <index-module-path> the recording will, so a "before" capture against a
# base ref is sized to that ref's output, not the working tree's.
measure_status=0
needed_size="$("$tsx" "$runner" --size "$index_module_path" "$sample_arg")" || measure_status=$?
if [ "$measure_status" -ne 0 ]; then
  echo "could not render $sample_arg via $index_module_path to measure its terminal size (see above)" >&2
  if [ "$measure_status" -eq 2 ]; then
    exit "$EXIT_USAGE"
  fi
  exit "$EXIT_FAILURE"
fi
needed_cols="${needed_size%% *}"
needed_rows="${needed_size##* }"

fit_cols=$((needed_cols + SIZE_MARGIN))
fit_rows=$((needed_rows + SIZE_MARGIN))
if [ -n "$cols_arg" ]; then
  cols="$cols_arg"
else
  cols=$((fit_cols > DEFAULT_MIN_COLS ? fit_cols : DEFAULT_MIN_COLS))
fi
if [ -n "$rows_arg" ]; then
  rows="$rows_arg"
else
  rows=$((fit_rows > DEFAULT_MIN_ROWS ? fit_rows : DEFAULT_MIN_ROWS))
fi
if [ "$cols" -lt "$needed_cols" ] || [ "$rows" -lt "$needed_rows" ]; then
  echo "warning: requested ${cols}x${rows} terminal is smaller than the ${needed_cols}x${needed_rows} this sample renders at - the recording will clip (omit [cols] [rows] to auto-fit)" >&2
fi

case "$size_flag_form" in
window-size) size_args=(--window-size "${cols}x${rows}") ;;
cols-rows) size_args=(--cols "$cols" --rows "$rows") ;;
esac

# Values are passed via environment rather than interpolated into the -c
# string: a path/index containing a quote would otherwise close the quoted
# argument early and inject shell syntax into the recorded PTY command.
# The single-quoted -c string is intentional: it must stay literal here so
# $RUNNER etc. expand inside the shell asciinema spawns for the recording,
# not in this script's own shell.
#
# Invoke the already-verified local tsx binary directly rather than `npx
# tsx`: npx's own resolve/spinner sequence can emit terminal control codes
# (cursor-column-move + clear-line) into this same recorded PTY, and since
# renderMermaidASCII's output has no trailing newline after its last line,
# that cleanup sequence can land on and erase the diagram's final line
# before the recording ends - a silent, reproducible clipping bug.
#
# Hide the cursor before running the command, and don't show it again: the
# recording's final frame is whatever the cursor state was when the PTY
# closed, and agg renders a still-visible cursor as an opaque block over
# whatever character it sits on. Since the PTY is closed right after the
# command exits, there's no later terminal session to leave in a hidden-
# cursor state - nothing depends on restoring it.
# shellcheck disable=SC2016
TSX="$tsx" RUNNER="$runner" INDEX_MODULE_PATH="$index_module_path" SAMPLE_ARG="$sample_arg" \
  asciinema record --overwrite --quiet \
  -c 'printf "\033[?25l"; "$TSX" "$RUNNER" "$INDEX_MODULE_PATH" "$SAMPLE_ARG"' \
  "${size_args[@]}" \
  "${out_prefix}.cast"

# Guard against the failure mode above actually happening: the header is the
# recording's own statement of the PTY size it captured, so a mismatch means
# every downstream artifact (.gif, .png) would be clipped/wrapped without any
# other error. asciicast v3 puts the size under "term"; v2 uses top-level
# width/height.
recorded_size="$(
  python3 - "${out_prefix}.cast" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as cast:
    header = json.loads(cast.readline())
term = header.get("term") or {}
cols = term.get("cols", header.get("width"))
rows = term.get("rows", header.get("height"))
print(f"{cols}x{rows}")
PY
)"
if [ "$recorded_size" != "${cols}x${rows}" ]; then
  echo "$asciinema_version recorded a ${recorded_size} terminal, not the requested ${cols}x${rows}: it did not honor '${size_args[*]}', so ${out_prefix}.cast would silently clip the diagram (issue #483)" >&2
  exit "$EXIT_DEPENDENCY"
fi

asciinema convert --overwrite --quiet "${out_prefix}.cast" "${out_prefix}.txt"

# The first installed font in this list wins; agg falls back silently (no
# error) when one is missing. JetBrains Mono is listed first deliberately:
# Menlo is a stock macOS font that's essentially always present, so listing
# it first would make the "install JetBrains Mono" setup step a no-op on
# macOS - Menlo would still win every time. A missing/skipped font can
# render box-drawing junction glyphs (e.g. "┬") with a visible notch
# artifact under agg's swash rendering backend. See --help / this script's
# header comment.
agg --quiet \
  --font-family "JetBrains Mono,Menlo,SF Mono,Consolas,DejaVu Sans Mono,Liberation Mono" \
  --theme github-dark \
  --select 100% \
  "${out_prefix}.cast" "${out_prefix}.gif"

# The recording's only frame, cropped to content: sample the background from
# a corner pixel (the theme is dark, not white, so a fixed white-background
# diff would crop nothing) rather than assuming a particular color.
python3 - "$out_prefix" <<'PY'
import sys
from PIL import Image, ImageChops

prefix = sys.argv[1]
img = Image.open(f"{prefix}.gif")
img.seek(img.n_frames - 1)
img = img.convert("RGB")

bg_color = img.getpixel((2, 2))
bg = Image.new("RGB", img.size, bg_color)
bbox = ImageChops.difference(img, bg).getbbox()
if bbox:
    pad = 16
    bbox = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(img.width, bbox[2] + pad),
        min(img.height, bbox[3] + pad),
    )
    img = img.crop(bbox)
img.save(f"{prefix}.png")
PY

rm -f "${out_prefix}.gif"
echo "wrote ${out_prefix}.cast ${out_prefix}.txt ${out_prefix}.png (${cols}x${rows} terminal)"
