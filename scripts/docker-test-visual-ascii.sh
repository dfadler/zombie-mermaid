#!/usr/bin/env bash
# Runs the ASCII/terminal half of the visual-regression suite
# (__tests__/visual/ascii-samples.visual.test.ts) inside the font-corrected
# Playwright container, against the committed -chromium-linux.png baselines.
#
# WHY THIS EXISTS, AND WHY IT IS ASCII-ONLY
#
# A local `pnpm run test:visual` on macOS compares against the
# -chromium-darwin.png baselines, so it can't tell you whether the Linux
# baselines CI actually gates on are still good. Running the suite in the
# Linux container can - but only for the ASCII half, and only with the font
# fix in docker/visual-regression.Dockerfile applied:
#
#   - The stock `mcr.microsoft.com/playwright:*` tag ships no DejaVu family,
#     so fontconfig resolves generic `monospace` to a CJK face that renders
#     box-drawing glyphs at full width. 88 of 90 ASCII samples mismatch
#     (issue #545, and the earlier #326 observation). Adding
#     `fonts-dejavu-core` takes that to 0 of 90 against the same committed
#     baselines, reproduced three times - issue #614,
#     docs/research/614-docker-font-parity.md.
#   - Architecture is irrelevant to ASCII output: issue #615 diffed the
#     arm64 and emulated-amd64 containers' own ASCII screenshots against
#     each other and found a max per-pixel channel delta of 1/255, far under
#     the suite's `threshold: 0.4`. So this runs natively (fast) by default
#     and still matches what CI's amd64 runner produces.
#
# The SVG half is deliberately NOT run here. On native arm64 it shows ~5%
# intermittent failures against the shared x86 baselines - different samples
# every run, not sub-pixel - and `--platform linux/amd64` avoids that but
# costs ~11x wall clock. Neither is a defensible local workflow until issue
# #549's real CI container run settles what the shared target is. See the
# 2026-09-07 amendment in
# docs/decisions/playwright-docker-image-visual-regression.md.
#
# HOW IT RUNS
#
# The repo is never mounted read-write. A copy is synced into a cache
# directory outside the repo (`--work-dir`), the container runs as the
# invoking UID/GID so nothing it writes is root-owned, and the Linux
# node_modules / pnpm store live in that cache rather than clobbering the
# host's darwin-native install. Baselines are read from the copy, so this
# script can never modify a committed PNG - which is also why
# --update-snapshots is rejected outright (see usage).
set -euo pipefail

EXIT_OK=0
EXIT_FAILURE=1
EXIT_USAGE=2
EXIT_DEPENDENCY=4
EXIT_INTERNAL=20

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Pinned to the `@playwright/test` version in package.json, matching the base
# tag in docker/visual-regression.Dockerfile. Bump all three in lockstep.
DEFAULT_IMAGE="zombie-mermaid/playwright-visual:v1.62.1-jammy"
TEST_TARGET="__tests__/visual/ascii-samples.visual.test.ts"

usage() {
  cat <<'EOF'
Usage: scripts/docker-test-visual-ascii.sh [options] [-- <extra playwright flags>]

Runs __tests__/visual/ascii-samples.visual.test.ts inside the font-corrected
Playwright container (docker/visual-regression.Dockerfile) against the
committed -chromium-linux.png baselines, so a non-Linux contributor can check
the baselines CI actually gates on.

ASCII ONLY. The SVG half of the visual suite is not supported through this
path and passing a different test target is rejected. Running SVG samples in
a container is blocked on issue #549 (the real CI container run) - native
arm64 produces ~5% intermittent SVG failures against the shared x86
baselines, and emulated amd64 costs ~11x wall clock. See the 2026-09-07
amendment in docs/decisions/playwright-docker-image-visual-regression.md, and
issues #550 / #551 for the wider consolidation question.

Options:
  -h, --help            Show this help and exit.
      --platform PLAT   Docker platform to build and run (default: the host's
                        native platform - linux/arm64 or linux/amd64). ASCII
                        output is architecture-independent (issue #615), so
                        the native default is both faster and CI-accurate.
      --image REF       Image tag to build/run (default:
                        zombie-mermaid/playwright-visual:v1.62.1-jammy).
      --no-build        Skip `docker build` and use the existing local image.
      --work-dir DIR    Where the container-side copy of the repo, its Linux
                        node_modules, and any failure artifacts live
                        (default: $XDG_CACHE_HOME/zombie-mermaid/... , outside
                        the repo).
      --clean           Delete the work directory before syncing. Forces a
                        fresh `pnpm install` inside the container.

Anything after `--` is appended to the `playwright test` invocation, e.g.
`-- --reporter=line` or `-- --grep=Sequence`. Every argument there must be a
flag, and a flag that takes a value must use the `--flag=value` form: a bare
word is treated as a test-target change and rejected, which is what keeps
this wrapper ASCII-only. --update-snapshots / -u is rejected too - the
committed PNGs are the measuring instrument for issues #614/#615/#549 and
must not be regenerated from a container (see the decision doc).

Exit codes: 0 all ASCII samples matched; 1 at least one mismatched (or
Playwright otherwise failed); 2 usage error; 4 a missing or misbehaving
dependency (docker, rsync, the Docker daemon, or an image whose generic
`monospace` doesn't resolve to DejaVu); 20 an unexpected internal failure.
EOF
}

die() {
  local code="$1"
  shift
  printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2
  exit "$code"
}

host_platform() {
  case "$(uname -m)" in
  arm64 | aarch64) printf 'linux/arm64' ;;
  x86_64 | amd64) printf 'linux/amd64' ;;
  *) return 1 ;;
  esac
}

platform=""
image="$DEFAULT_IMAGE"
do_build=1
do_clean=0
work_dir=""
playwright_args=()

while [ "$#" -gt 0 ]; do
  case "$1" in
  -h | --help)
    usage
    exit "$EXIT_OK"
    ;;
  --platform)
    [ "$#" -ge 2 ] || die "$EXIT_USAGE" "--platform needs a value (e.g. linux/amd64)"
    platform="$2"
    shift 2
    ;;
  --image)
    [ "$#" -ge 2 ] || die "$EXIT_USAGE" "--image needs a value"
    image="$2"
    shift 2
    ;;
  --work-dir)
    [ "$#" -ge 2 ] || die "$EXIT_USAGE" "--work-dir needs a value"
    work_dir="$2"
    shift 2
    ;;
  --no-build)
    do_build=0
    shift
    ;;
  --clean)
    do_clean=1
    shift
    ;;
  --)
    shift
    playwright_args=("$@")
    break
    ;;
  *)
    die "$EXIT_USAGE" "unknown argument '$1' (see --help; pass Playwright flags after --)"
    ;;
  esac
done

for arg in ${playwright_args[@]+"${playwright_args[@]}"}; do
  case "$arg" in
  -u | --update-snapshots | --update-snapshots=*)
    die "$EXIT_USAGE" "refusing --update-snapshots: the committed baselines are the measuring instrument for issues #614/#615/#549 and must not be regenerated from a container (see docs/decisions/playwright-docker-image-visual-regression.md). Regenerate on the platform that owns the baseline instead."
    ;;
  -*) ;;
  *)
    die "$EXIT_USAGE" "'$arg' would change the test target; this wrapper only runs $TEST_TARGET. A Playwright flag that takes a value must be passed as --flag=value (see --help)."
    ;;
  esac
done

if [ -z "$platform" ]; then
  platform="$(host_platform)" ||
    die "$EXIT_DEPENDENCY" "unrecognized host architecture '$(uname -m)'; pass --platform explicitly"
fi

command -v docker >/dev/null 2>&1 ||
  die "$EXIT_DEPENDENCY" "docker not found on PATH"
command -v rsync >/dev/null 2>&1 ||
  die "$EXIT_DEPENDENCY" "rsync not found on PATH (used to snapshot the repo outside itself)"
docker info >/dev/null 2>&1 ||
  die "$EXIT_DEPENDENCY" "the Docker daemon is not reachable (is Docker Desktop running?)"

[ -f "$REPO_ROOT/$TEST_TARGET" ] ||
  die "$EXIT_INTERNAL" "expected $TEST_TARGET under $REPO_ROOT"

if [ -z "$work_dir" ]; then
  cache_root="${XDG_CACHE_HOME:-$HOME/.cache}/zombie-mermaid/docker-visual-ascii"
  # Keyed on the checkout path so several worktrees don't fight over one
  # node_modules tree (this repo's CLAUDE.md notes worktrees here get no
  # shared install).
  checkout_key="$(printf '%s' "$REPO_ROOT" | cksum | cut -d' ' -f1)"
  work_dir="$cache_root/$(basename "$REPO_ROOT")-$checkout_key"
fi

mkdir -p "$work_dir"

# Canonicalize both sides before comparing: --work-dir may be relative,
# contain a trailing slash, or reach the repo root via a symlink, and a
# string-prefix match on the raw arguments would miss all three. A work
# directory that resolves to the repo root or any descendant of it is
# rejected outright - --clean below runs `rm -rf "$work_dir"`, which would
# delete the real checkout, and even without --clean the later `docker run
# -v "$work_dir:/work"` would mount (and let the container's `pnpm install`
# write into) the real checkout instead of an isolated copy.
canonical_work_dir="$(cd "$work_dir" && pwd -P)"
canonical_repo_root="$(cd "$REPO_ROOT" && pwd -P)"
case "$canonical_work_dir/" in
"$canonical_repo_root/"*)
  die "$EXIT_USAGE" "--work-dir '$work_dir' resolves to the repository checkout ($canonical_repo_root) or a path inside it; pass a directory outside the repo"
  ;;
esac

if [ "$do_clean" -eq 1 ] && [ -d "$work_dir" ]; then
  printf '%s: cleaning %s\n' "$SCRIPT_NAME" "$work_dir"
  rm -rf "$work_dir"
  mkdir -p "$work_dir"
fi

if [ "$do_build" -eq 1 ]; then
  printf '%s: building %s for %s\n' "$SCRIPT_NAME" "$image" "$platform"
  docker build \
    --platform "$platform" \
    -t "$image" \
    -f "$REPO_ROOT/docker/visual-regression.Dockerfile" \
    "$REPO_ROOT/docker" ||
    die "$EXIT_DEPENDENCY" "docker build failed"
fi

# A copy, not a mount: the host's node_modules holds darwin-native binaries
# (esbuild, rollup) that a Linux container can't execute, and keeping the
# repo out of the container's write path means a stray --update-snapshots
# could never reach a committed baseline. --delete keeps a stale copy from
# masking a deleted sample; excluded paths are not deleted from the
# destination, which is what lets the Linux node_modules persist here across
# runs.
printf '%s: syncing repo into %s\n' "$SCRIPT_NAME" "$work_dir"
rsync -a --delete \
  --exclude 'node_modules/' \
  --exclude '.git' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  --exclude 'blob-report/' \
  --exclude 'coverage/' \
  --exclude 'dist/' \
  --exclude 'site/' \
  --exclude '.fork-fixes-cache/' \
  --exclude '.visual-diff-cache/' \
  --exclude '.form-facts/' \
  --exclude '.form-judge-cache/' \
  --exclude '.container-home/' \
  "$REPO_ROOT/" "$work_dir/" ||
  die "$EXIT_DEPENDENCY" "rsync of the repo into the work directory failed"

# Single-quoted on purpose: this is the container's script text, and every
# expansion in it ($HOME, $PATH, $@, the fc-match capture) must happen inside
# the container, not on the host.
# shellcheck disable=SC2016
container_script='
set -eu

# Guard against an --image override (or a future base-tag bump) that lost the
# font layer: without it every ASCII sample mismatches and the run looks like
# a real regression. Same assertion the Dockerfile makes at build time.
#
# Exact family match, not a `DejaVu*` glob: fonts-dejavu-core installs DejaVu
# Sans (proportional) alongside DejaVu Sans Mono, so a glob would also accept
# the proportional face here - silently defeating this guard if `monospace`
# ever misresolved to it, since the ASCII grid needs an actually-monospaced
# font.
match="$(fc-match -f "%{family}" monospace)"
if [ "$match" != "DejaVu Sans Mono" ]; then
  echo "fc-match monospace resolved to: $match (expected DejaVu Sans Mono)" >&2
  echo "This image lacks the fonts-dejavu-core layer; every ASCII sample would mismatch." >&2
  exit 4
fi

export COREPACK_HOME="$HOME/.cache/node/corepack"
mkdir -p "$HOME/.bin" "$COREPACK_HOME"
# --install-directory keeps corepack out of /usr/local, which is root-owned;
# this container runs as the invoking host user.
corepack enable --install-directory "$HOME/.bin"
export PATH="$HOME/.bin:$PATH"

pnpm install --frozen-lockfile
exec pnpm exec playwright test "$@"
'

printf '%s: running %s in %s (%s)\n' "$SCRIPT_NAME" "$TEST_TARGET" "$image" "$platform"

status=0
docker run --rm \
  --platform "$platform" \
  --user "$(id -u):$(id -g)" \
  --ipc=host \
  -v "$work_dir:/work" \
  -w /work \
  -e HOME=/work/.container-home \
  "$image" \
  bash -c "$container_script" -- "$TEST_TARGET" \
  ${playwright_args[@]+"${playwright_args[@]}"} ||
  status=$?

case "$status" in
0)
  printf '%s: ASCII samples match the committed -chromium-linux.png baselines.\n' "$SCRIPT_NAME"
  exit "$EXIT_OK"
  ;;
1)
  printf '%s: at least one ASCII sample failed. Diffs and the HTML report are under:\n  %s/test-results\n  %s/playwright-report\n' \
    "$SCRIPT_NAME" "$work_dir" "$work_dir" >&2
  exit "$EXIT_FAILURE"
  ;;
4 | 125 | 126 | 127)
  exit "$EXIT_DEPENDENCY"
  ;;
*)
  printf '%s: container exited %d, which is neither a clean pass nor a Playwright test failure.\n' \
    "$SCRIPT_NAME" "$status" >&2
  exit "$EXIT_INTERNAL"
  ;;
esac
