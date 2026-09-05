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
EXIT_USAGE=2
EXIT_DEPENDENCY=4

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
  [cols] [rows]           Terminal size in character cells (default 100x40).

Set ASCII_RENDER_OPTIONS='{"hyperlinks":true}' (any JSON object of
renderMermaidASCII options) in the environment to capture an opt-in render
option; the PTY inherits it. See scripts/ascii-render-runner.mjs.

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
cols="${4:-100}"
rows="${5:-40}"

for cmd in asciinema agg python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing dependency: $cmd (see --help for install instructions)" >&2
    exit "$EXIT_DEPENDENCY"
  fi
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="$script_dir/ascii-render-runner.mjs"

repo_root="$(cd "$script_dir/.." && pwd)"
if [ ! -x "$repo_root/node_modules/.bin/tsx" ]; then
  echo "missing dependency: tsx (run 'pnpm install' in $repo_root first)" >&2
  exit "$EXIT_DEPENDENCY"
fi

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
TSX="$repo_root/node_modules/.bin/tsx" RUNNER="$runner" INDEX_MODULE_PATH="$index_module_path" SAMPLE_ARG="$sample_arg" \
  asciinema record --overwrite --quiet \
  -c 'printf "\033[?25l"; "$TSX" "$RUNNER" "$INDEX_MODULE_PATH" "$SAMPLE_ARG"' \
  --window-size "${cols}x${rows}" \
  "${out_prefix}.cast"

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
echo "wrote ${out_prefix}.cast ${out_prefix}.txt ${out_prefix}.png"
