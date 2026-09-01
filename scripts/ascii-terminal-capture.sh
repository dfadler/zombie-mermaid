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
set -uo pipefail

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

Example (before/after a change, comparing against main):
  git archive main src | tar -x -C tmp-base-ref
  scripts/ascii-terminal-capture.sh ./src/index.ts 12 /tmp/after
  scripts/ascii-terminal-capture.sh ./tmp-base-ref/src/index.ts 12 /tmp/before
  diff /tmp/before.txt /tmp/after.txt

Requires (install once): brew install asciinema agg && pip3 install pillow
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

for cmd in npx asciinema agg python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing dependency: $cmd (see --help for install instructions)" >&2
    exit "$EXIT_DEPENDENCY"
  fi
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="$script_dir/ascii-render-runner.mjs"

asciinema record --overwrite --quiet \
  -c "npx tsx '$runner' '$index_module_path' '$sample_arg'" \
  --cols "$cols" --rows "$rows" \
  "${out_prefix}.cast"

asciinema convert --overwrite --quiet "${out_prefix}.cast" "${out_prefix}.txt"

agg --quiet \
  --font-family "Menlo,JetBrains Mono,SF Mono,Consolas,DejaVu Sans Mono,Liberation Mono" \
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
