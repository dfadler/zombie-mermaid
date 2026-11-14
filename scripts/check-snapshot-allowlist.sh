#!/usr/bin/env bash
# Guards against a new whole-tree snapshot test or raw string-pin creeping
# back into demo/editor component tests one unreviewed file at a time, now
# that RTL (`render()` + `screen.getByRole`/`getByText` + `userEvent`,
# docs/testing-conventions.md) is the expected pattern for them
# (zombie-mermaid#817, filed as part of the #815 RTL migration epic).
#
# WHAT THIS CHECKS
#
# Greps every *.test.ts / *.test.tsx file in the repo (excluding
# node_modules, build output, and other worktrees) for a call to
# `toMatchSnapshot(`, `toMatchFileSnapshot(`, or `toMatchInlineSnapshot(`.
# A match in a file not listed in this script's ALLOWLIST array fails the
# check. This repo already has one deliberate, justified user of
# toMatchFileSnapshot (__tests__/site-equivalence.test.ts's golden-DOM
# regression tests) plus several literal-value/CSS-pin tests that assert
# against transcribed design-canvas values without going through a
# snapshot matcher at all (__tests__/demo-design-tokens.test.ts,
# demo-footer.test.ts, demo-icons.test.ts, demo-primitives.test.ts,
# demo-nav.test.ts) — see docs/testing-conventions.md for why those are a
# deliberate exception to "prefer semantic RTL queries," not a mistake this
# check should flag. A future PR that wants a *new* snapshot test should
# have to add itself to ALLOWLIST deliberately, with a comment explaining
# why, rather than the check silently accepting it.
#
# This is a grep, not a parser: it does not distinguish a real call from
# one mentioned only in a comment or a string literal, and it does not
# understand allow-listing at a finer grain than "this whole file may use
# a snapshot matcher." That's an accepted trade-off for a check this cheap
# — the same trade-off this repo's own `// nosemgrep` comments make,
# reviewed by eye rather than mechanically verified.
set -euo pipefail

EXIT_OK=0
EXIT_FAILURE=1
EXIT_USAGE=2
EXIT_DEPENDENCY=4
EXIT_INTERNAL=20

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-h|--help]

Fails if any *.test.ts / *.test.tsx file outside this script's ALLOWLIST
array calls toMatchSnapshot(), toMatchFileSnapshot(), or
toMatchInlineSnapshot(). See docs/testing-conventions.md for this repo's
expected RTL test pattern and for when a literal-value/snapshot assertion
is still the right call. To add a deliberate, reviewed exception, edit the
ALLOWLIST array in this script and explain why in a comment above the
added entry.

Exit codes:
  $EXIT_OK  no disallowed snapshot/string-pin usage found
  $EXIT_FAILURE  disallowed usage found outside the allow-list
  $EXIT_USAGE  usage error (bad argument)
  $EXIT_DEPENDENCY  a required command (grep or find) isn't on PATH
  $EXIT_INTERNAL  unexpected internal failure
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
  -h | --help)
    usage
    exit "$EXIT_OK"
    ;;
  *)
    printf '%s: unknown argument %s (see --help)\n' "$SCRIPT_NAME" "$1" >&2
    exit "$EXIT_USAGE"
    ;;
  esac
done

for cmd in grep find; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf '%s: required command "%s" not found on PATH\n' "$SCRIPT_NAME" "$cmd" >&2
    exit "$EXIT_DEPENDENCY"
  fi
done

cd "$REPO_ROOT"

# Files allowed to call a snapshot matcher, one per entry, each with a
# comment explaining why it's a deliberate, reviewed exception rather than
# a mistake. See docs/testing-conventions.md's "when a literal-value
# assertion is still correct" section before adding to this list.
ALLOWLIST=(
  # SVG and ASCII goldens of a configured C4 diagram (#2906): the `c4` init
  # keys are a renderer-output contract, not demo/editor UI. Reviewed via
  # `git diff` on src/__tests__/__snapshots__/c4-init-2906.{svg,txt}.
  "src/__tests__/c4-init-2906.test.ts"
  # Golden-DOM regression tests for the five site-generator pages moved
  # from template-literal HTML to React (#589). The checked-in, normalized
  # HTML fixtures under __tests__/__fixtures__/ are reviewed via `git diff`
  # on any intentional markup change (`pnpm exec vitest -u`) — see this
  # file's own header comment for the full rationale.
  "__tests__/site-equivalence.test.ts"
  # Exact plain-text goldens of every sample's ASCII renderer output (#1708),
  # the tolerance-free counterpart to the ASCII PNG baselines. Not a demo/
  # editor component test; the .txt files under __tests__/__ascii-snapshots__/
  # are reviewed via `git diff` (`pnpm run test:ascii-text:update`).
  "__tests__/ascii-text-snapshots.test.ts"
  # Exact plain-text goldens of each shown fork-fixes entry's After render
  # (#2619): the drift guard that makes a renderer change fail until the
  # real-terminal screenshot is re-captured. Reviewed via `git diff` on the
  # .txt files under __tests__/__fork-fixes-snapshots__/.
  "__tests__/fork-fixes-ascii-snapshots.test.ts"
  # SVG + ASCII goldens for the opt-in themeVariables mapping (#2108): the
  # repo rule is an SVG and an ASCII snapshot per case. Not a component test;
  # the files under src/__tests__/__theme-variables-snapshots__/ are reviewed
  # via `git diff` (`vitest -u`).
  "src/__tests__/theme-variables-2108.test.ts"
  # SVG + ASCII goldens for each architecture service icon case (#2518): the
  # repo rule is an SVG and an ASCII snapshot per case. Not a component test;
  # the files under src/__tests__/__snapshots__/ are reviewed via `git diff`
  # (`vitest -u`).
  "src/__tests__/architecture-icon-tiles-2518.test.ts"
  # SVG + ASCII goldens for the architecture junction join and group header
  # icons (#2563, #2564); reviewed via `git diff` (`vitest -u`).
  "src/__tests__/architecture-junction-group-icon-2563-2564.test.ts"
  # SVG + ASCII goldens for architecture edge side hints (#2724): placement by
  # port, which is a whole-diagram property.
  "src/__tests__/architecture-side-hints-2724.test.ts"
  # SVG + ASCII goldens for the architecture init/front-matter keys (#2907):
  # one SVG per key that moves mermaid's output and the ASCII text they leave
  # unchanged; reviewed via the .snap diff.
  "src/__tests__/architecture-init-2907.test.ts"
  # SVG + ASCII goldens for a group that is one row of two services with
  # outside services below it (#2988); heights are asserted against
  # mermaid@12.3.0, the .snap diff is reviewed for the rest.
  "src/__tests__/architecture-group-row-2988.test.ts"
  # SVG + ASCII goldens for flowchart cloud/h-cyl/tag-rect/sm-circ/fork shapes
  # (#2552); reviewed via the .snap diff.
  "src/__tests__/flowchart-shapes-2552.test.ts"
  # Front matter title: SVG + ASCII output per diagram type (#2585); reviewed via
  # the .snap diff.
  "src/__tests__/front-matter-2585.test.ts"
  # SVG + ASCII goldens for a decision with a duplicated edge (#2780); reviewed via the .snap diff.
  "src/__tests__/ascii-decision-duplicate-edge-2780.test.ts"
  # ASCII + SVG goldens for opposing edges at a diamond vertex or slanted
  # side (#2492): the repo rule is an SVG and an ASCII snapshot per case.
  # Not a component test; the files under
  # packages/ascii-renderer/src/__tests__/ are reviewed via `git diff`
  # (`vitest -u`).
  "packages/ascii-renderer/src/__tests__/ascii-opposing-edges-diamond-2492.test.ts"
  # ASCII + SVG goldens for a compact LR labelled fan-out (#2561), same rule
  # and review path as above.
  "packages/ascii-renderer/src/__tests__/ascii-lr-compact-labeled-fanout-2561.test.ts"
  # ASCII + SVG goldens for a block wall that encloses its notes (#2514),
  # same rule and review path as above.
  "packages/ascii-renderer/src/__tests__/ascii-sequence-block-notes-2514.test.ts"
  # ASCII + SVG goldens for a note before a block's first message (#2531),
  # same rule and review path as above.
  "packages/ascii-renderer/src/__tests__/ascii-sequence-note-before-first-message-2531.test.ts"
  # ASCII + SVG goldens for a note after a block's `end` (#2744),
  # same rule and review path as above.
  "packages/ascii-renderer/src/__tests__/ascii-sequence-note-after-end-2744.test.ts"
  # ASCII + SVG goldens for slanted shapes stretched taller than 5 rows
  # (#2164): the repo rule is an SVG and an ASCII snapshot per case. Not a
  # component test; the files under packages/ascii-renderer/src/__tests__/
  # are reviewed via `git diff` (`vitest -u`).
  "packages/ascii-renderer/src/__tests__/ascii-tall-slanted-shapes-2164.test.ts"
  # SVG + ASCII goldens for an empty subgraph (#2694): the repo rule is an SVG
  # and an ASCII snapshot per case; reviewed via `git diff` (`vitest -u`).
  "packages/ascii-renderer/src/__tests__/ascii-empty-subgraph-2694.test.ts"
  # SVG + ASCII goldens for a cluster-boundary cycle in both declaration orders
  # (#2802): the repo rule is an SVG and an ASCII snapshot per case; reviewed
  # via `git diff` (`vitest -u`).
  "packages/ascii-renderer/src/__tests__/ascii-cluster-cycle-rank-2802.test.ts"
  # SVG + ASCII goldens for numeric x-axis ranges on an xychart (#1592): the
  # repo rule is an SVG and an ASCII snapshot per case. Not a component test;
  # the files under src/__tests__/__snapshots__/ are reviewed via `git diff`
  # (`vitest -u`).
  "src/__tests__/xychart-numeric-axis-1592.test.ts"
  # SVG + ASCII goldens for the cluster exit siblings (#2913): the repo rule is
  # an SVG and an ASCII snapshot per case; reviewed via `git diff` (`vitest -u`).
  "__tests__/ascii-cluster-exit-siblings-faces-2913.test.ts"
  # SVG + ASCII goldens for dashed class relations across namespace frames
  # (#2678): the repo rule is an SVG and an ASCII snapshot per case; reviewed
  # via `git diff` (`vitest -u`).
  "__tests__/ascii-class-namespace-dashed-2678.test.ts"
  # SVG + ASCII goldens for nested duplicate self-loops (#2913): the repo rule
  # is an SVG and an ASCII snapshot per case; reviewed via `git diff`
  # (`vitest -u`).
  "__tests__/ascii-nested-self-loops-2913.test.ts"
  "__tests__/ascii-subgraph-nested-self-loops-2913.test.ts"
  # SVG + ASCII goldens for an arrowless edge into a subgraph (#3043): the repo
  # rule is an SVG and an ASCII snapshot per case; reviewed via `git diff`
  # (`vitest -u`).
  "__tests__/ascii-arrowless-cluster-entry-3043.test.ts"
  # SVG + ASCII goldens for a decision's entry face with three ends (#2913): the
  # repo rule is an SVG and an ASCII snapshot per case; reviewed via `git diff`
  # (`vitest -u`).
  "__tests__/ascii-decision-entry-face-2913.test.ts"
)

is_allowlisted() {
  local file="$1"
  local entry
  for entry in "${ALLOWLIST[@]}"; do
    if [ "$entry" = "$file" ]; then
      return 0
    fi
  done
  return 1
}

PATTERN='\.toMatchFileSnapshot\(|\.toMatchSnapshot\(|\.toMatchInlineSnapshot\('

violations=()
while IFS= read -r -d '' file; do
  rel="${file#./}"
  if grep -Eq "$PATTERN" "$file"; then
    if ! is_allowlisted "$rel"; then
      violations+=("$rel")
    fi
  fi
done < <(
  find . \
    \( -path './node_modules' -o -path './dist' -o -path './site' -o -path './coverage' -o -path './.claude' \) -prune -o \
    -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -print0
)

if [ "${#violations[@]}" -gt 0 ]; then
  printf '%s: found snapshot/string-pin matcher usage outside the allow-list:\n' "$SCRIPT_NAME" >&2
  for v in "${violations[@]}"; do
    printf '  - %s\n' "$v" >&2
  done
  printf '\nSee docs/testing-conventions.md for the RTL pattern this repo expects for demo/editor component tests, and for when a literal-value/snapshot assertion is still justified. If this usage is a deliberate, reviewed exception, add it to the ALLOWLIST array in %s, with a comment explaining why.\n' "$SCRIPT_DIR/$SCRIPT_NAME" >&2
  exit "$EXIT_FAILURE"
fi

exit "$EXIT_OK"
