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
# The `agg` rasterization step (.cast -> .gif) can run either against a
# local `agg` binary + font install (the default, see --help), or inside
# agg's own maintainer-published Docker image via ASCII_AGG_RUNTIME=docker
# (see --help) - that image bundles JetBrains Mono directly, so it can't hit
# the font-substitution failure mode described below at all. `asciinema`
# recording itself is not containerized: it has to drive the real PTY this
# script's own process is attached to, which a container can't do without
# losing the `--select` terminal it's recording (see issue #552).
#
# The .cast -> .png step has two rasterisers: agg (the default) and Chromium
# (ASCII_RASTERISER=chromium, see --help). agg draws the horizontal arm of a
# box junction (`┼`, `├`) a pixel or more off the plain `─` bar, so an edge
# crossing a frame wall shows a visible step; Chromium aligns them. Both start
# from the same real-PTY .cast (see docs/research/ascii-capture-smoothing).
#
# Usage: scripts/ascii-terminal-capture.sh <index-module-path> <sample-index-or-file> <output-prefix> [cols] [rows]
set -euo pipefail

EXIT_OK=0
EXIT_FAILURE=1
EXIT_USAGE=2
EXIT_DEPENDENCY=4

# agg rasterization runtime: "local" (default) uses the `agg` binary on
# PATH; "docker" runs agg's own maintainer image instead (see --help).
ASCII_AGG_RUNTIME="${ASCII_AGG_RUNTIME:-local}"
ASCII_AGG_DOCKER_IMAGE="${ASCII_AGG_DOCKER_IMAGE:-ghcr.io/asciinema/agg:latest}"

# .cast -> .png rasteriser: "agg" (default) or "chromium" (see --help).
ASCII_RASTERISER="${ASCII_RASTERISER:-agg}"

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
                           extracted via
                           `git archive <ref> src packages tsconfig.json | tar -x -C <dir>`.
                           renderMermaidASCII's implementation lives entirely
                           under packages/ascii-renderer/src (imported via
                           the bare specifier @zombie-mermaid/ascii-renderer,
                           which itself imports @zombie-mermaid/core and
                           @zombie-mermaid/mermaid-parser) - archiving only
                           src/ leaves those bare imports unresolved against
                           <dir> and silently re-resolves them against this
                           repo's own packages/ instead (see issue #1141),
                           making a "before" capture identical to "after"
                           for any change under packages/*/src. tsconfig.json
                           must be archived alongside them: this script reads
                           it (via tsx --tsconfig) to resolve those bare
                           imports within <dir> instead of this repo root.
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

Exit codes: 0 ok; 1 the sample failed to render; 2 usage error (including
<index-module-path>'s tree root missing its own tsconfig.json); 4 a missing
or misbehaving dependency (asciinema, agg or docker, python3, tsx, or a
recorded terminal size that doesn't match the requested one).

Set ASCII_RENDER_OPTIONS='{"hyperlinks":true}' (any JSON object of
renderMermaidASCII options) in the environment to capture an opt-in render
option; the PTY inherits it. See scripts/ascii-render-runner.mjs.

Set ASCII_AGG_RUNTIME=docker to rasterize the .cast through agg's own
maintainer-published Docker image (ghcr.io/asciinema/agg, built from
github.com/asciinema/agg's Dockerfile) instead of a local `agg` binary.
That image installs JetBrains Mono directly (Debian's fonts-jetbrains-mono
package, not a host bind-mount), so it cannot hit the font-substitution
failure mode described below at all - verified in issue #552 by diffing a
docker-rasterized .png against a correctly-configured local-agg one
(byte-identical) and against a deliberately font-incomplete render (visibly
different, confirming the check is sensitive). Only the `agg` step is
containerized; `asciinema record` still runs locally, since it has to drive
the real PTY this script's own process is attached to. Override the image
with ASCII_AGG_DOCKER_IMAGE (e.g. to pin a digest). Requires `docker` on
PATH and a reachable daemon instead of a local `agg` install; python3 and
the font install are still required either way (the crop step runs
locally).

Set ASCII_RASTERISER=chromium to rasterize the .cast with headless Chromium
instead of agg. The recording is still a real PTY, and it is replayed through
@xterm/headless (real terminal emulation) before drawing, so only the glyph
rasterizer changes. Use it when the screenshot has to show smooth lines: agg
draws a box junction's horizontal arm (`┼`, `├`) a pixel or more off the plain
`─` bar, so an edge crossing a frame wall shows a step (see
docs/research/ascii-capture-smoothing/README.md). Needs node and the
repo's installed @xterm/headless and Playwright Chromium instead of agg;
python3 + pillow are still required for the crop. The PNG is rendered at 2x.
Not combinable with ASCII_AGG_RUNTIME=docker. Default is agg.

Example (before/after a change, comparing against main):
  mkdir -p tmp-base-ref
  git archive main src packages tsconfig.json | tar -x -C tmp-base-ref
  scripts/ascii-terminal-capture.sh ./src/index.ts 12 /tmp/after
  scripts/ascii-terminal-capture.sh ./tmp-base-ref/src/index.ts 12 /tmp/before
  diff /tmp/before.txt /tmp/after.txt

Requires (install once): brew install asciinema agg && pip3 install pillow
Also install the first font in the --font-family list below (e.g.
brew install --cask font-jetbrains-mono) - a missing font falls back
silently to the next one with no error, and can produce subtle
box-drawing glyph artifacts (e.g. a notched "┬") rather than an
obvious failure. Or set ASCII_AGG_RUNTIME=docker (see above) to skip
installing `agg` and the font locally - only `docker` is then required for
the rasterization step.
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

case "$ASCII_AGG_RUNTIME" in
local | docker) ;;
*)
  echo "invalid ASCII_AGG_RUNTIME '$ASCII_AGG_RUNTIME': must be 'local' or 'docker'" >&2
  exit "$EXIT_USAGE"
  ;;
esac

case "$ASCII_RASTERISER" in
agg | chromium) ;;
*)
  echo "invalid ASCII_RASTERISER '$ASCII_RASTERISER': must be 'agg' or 'chromium'" >&2
  exit "$EXIT_USAGE"
  ;;
esac
if [ "$ASCII_RASTERISER" = chromium ] && [ "$ASCII_AGG_RUNTIME" != local ]; then
  echo "ASCII_RASTERISER=chromium doesn't use agg, so ASCII_AGG_RUNTIME='$ASCII_AGG_RUNTIME' has no effect: unset it" >&2
  exit "$EXIT_USAGE"
fi

# agg itself is only required locally in "local" mode; in "docker" mode its
# rasterization runs inside ASCII_AGG_DOCKER_IMAGE instead, so `docker` (and
# a reachable daemon) is required in its place.
agg_deps=(asciinema python3)
if [ "$ASCII_RASTERISER" = chromium ]; then
  agg_deps+=(node)
elif [ "$ASCII_AGG_RUNTIME" = local ]; then
  agg_deps+=(agg)
else
  agg_deps+=(docker)
fi
for cmd in "${agg_deps[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing dependency: $cmd (see --help for install instructions)" >&2
    exit "$EXIT_DEPENDENCY"
  fi
done
if [ "$ASCII_RASTERISER" = agg ] && [ "$ASCII_AGG_RUNTIME" = docker ] && ! docker info >/dev/null 2>&1; then
  echo "docker is on PATH but its daemon isn't reachable (ASCII_AGG_RUNTIME=docker needs a running Docker daemon)" >&2
  exit "$EXIT_DEPENDENCY"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="$script_dir/ascii-render-runner.mjs"

repo_root="$(cd "$script_dir/.." && pwd)"
tsx="$repo_root/node_modules/.bin/tsx"
if [ ! -x "$tsx" ]; then
  echo "missing dependency: tsx (run 'pnpm install' in $repo_root first)" >&2
  exit "$EXIT_DEPENDENCY"
fi

# <index-module-path> is always <tree-root>/src/index.ts, whether <tree-root>
# is this repo root (the working tree) or a scratch dir a base ref was
# archived into. renderMermaidASCII lives in @zombie-mermaid/ascii-renderer
# (and that package itself imports @zombie-mermaid/core and
# @zombie-mermaid/mermaid-parser) - all bare specifiers, resolved by tsx via
# tsconfig.json's `paths`. Passing --tsconfig here pins that resolution to
# <tree-root>'s own tsconfig.json instead of tsx's default lookup (nearest
# tsconfig from cwd), which is always *this* repo root's tsconfig.json
# regardless of <index-module-path> - so without this flag, a "before"
# capture against an archived base ref silently re-resolves every
# @zombie-mermaid/* import back to the current working tree's packages/,
# making before == after for any change under packages/*/src (see issue
# #1141). For the working tree case <tree-root> IS the repo root, so this is
# a no-op there - the flag is only load-bearing for an archived ref.
index_module_dir="$(cd "$(dirname "$index_module_path")" && pwd)"
tree_root="$(cd "$index_module_dir/.." && pwd)"
tsconfig_path="$tree_root/tsconfig.json"
if [ ! -f "$tsconfig_path" ]; then
  echo "missing $tsconfig_path: <index-module-path>'s tree root must have its own tsconfig.json alongside src/ - for a base-ref extraction, archive it too (see --help's example)" >&2
  exit "$EXIT_USAGE"
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
needed_size="$("$tsx" --tsconfig "$tsconfig_path" "$runner" --size "$index_module_path" "$sample_arg")" || measure_status=$?
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
TSX="$tsx" TSCONFIG_PATH="$tsconfig_path" RUNNER="$runner" INDEX_MODULE_PATH="$index_module_path" SAMPLE_ARG="$sample_arg" \
  asciinema record --overwrite --quiet \
  -c 'printf "\033[?25l"; "$TSX" --tsconfig "$TSCONFIG_PATH" "$RUNNER" "$INDEX_MODULE_PATH" "$SAMPLE_ARG"' \
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
#
# In ASCII_AGG_RUNTIME=docker mode, that same font list is passed to agg's
# maintainer-published Docker image instead of the local binary - the image
# installs JetBrains Mono itself (Debian's fonts-jetbrains-mono package), so
# the fallback this comment warns about can't happen there; the list is
# still passed as-is so a docker run behaves identically to a fully correct
# local install (verified byte-identical in issue #552).
agg_font_family="JetBrains Mono,Menlo,SF Mono,Consolas,DejaVu Sans Mono,Liberation Mono"
if [ "$ASCII_RASTERISER" = chromium ]; then
  # Replays the .cast through @xterm/headless and draws the cell grid in
  # Chromium; the crop step below reads the resulting PNG.
  raster_input="${out_prefix}.raw.png"
  crop_pad=32
  if ! node "$script_dir/ascii-cast-to-png.mjs" "${out_prefix}.cast" "$raster_input"; then
    echo "chromium rasterization failed (needs node, the repo's installed @xterm/headless and Playwright Chromium; see --help)" >&2
    exit "$EXIT_DEPENDENCY"
  fi
else
  raster_input="${out_prefix}.gif"
  crop_pad=16
  if [ "$ASCII_AGG_RUNTIME" = docker ]; then
    # agg only reads/writes inside the mounted directory, addressed by
    # basename - resolve out_prefix's directory to an absolute path first
    # since a relative bind-mount source is rejected by `docker run -v`.
    out_abs_dir="$(cd "$(dirname "$out_prefix")" && pwd)"
    out_base="$(basename "$out_prefix")"
    docker run --rm -v "${out_abs_dir}:/data" "$ASCII_AGG_DOCKER_IMAGE" \
      --font-family "$agg_font_family" \
      --theme github-dark \
      --select 100% \
      "/data/${out_base}.cast" "/data/${out_base}.gif"
  else
    agg --quiet \
      --font-family "$agg_font_family" \
      --theme github-dark \
      --select 100% \
      "${out_prefix}.cast" "${out_prefix}.gif"
  fi
fi

# The recording's only frame, cropped to content: sample the background from
# a corner pixel (the theme is dark, not white, so a fixed white-background
# diff would crop nothing) rather than assuming a particular color.
python3 - "$out_prefix" "$raster_input" "$crop_pad" <<'PY'
import sys
from PIL import Image, ImageChops

prefix = sys.argv[1]
img = Image.open(sys.argv[2])
img.seek(img.n_frames - 1)
img = img.convert("RGB")

bg_color = img.getpixel((2, 2))
bg = Image.new("RGB", img.size, bg_color)
bbox = ImageChops.difference(img, bg).getbbox()
if bbox:
    pad = int(sys.argv[3])
    bbox = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(img.width, bbox[2] + pad),
        min(img.height, bbox[3] + pad),
    )
    img = img.crop(bbox)
img.save(f"{prefix}.png")
PY

rm -f "$raster_input"
if [ "$ASCII_RASTERISER" = chromium ]; then
  rasteriser_note="chromium"
else
  rasteriser_note="agg via ${ASCII_AGG_RUNTIME}"
fi
echo "wrote ${out_prefix}.cast ${out_prefix}.txt ${out_prefix}.png (${cols}x${rows} terminal, ${rasteriser_note})"
