#!/usr/bin/env bash
# Reproducible spike for zombie-mermaid#2138 (adopt Oxc's oxlint/oxfmt?).
# NO ADOPTION: nothing here touches the checkout's package.json, lockfile or
# config. It archives a git ref into a scratch dir, installs oxlint/oxfmt
# THERE, and prints a comparison against the repo's current eslint/prettier.
#
# WHAT RUNS (all inside the scratch copy):
#   git archive <ref>; pnpm install --frozen-lockfile;
#   pnpm add -Dw oxlint@<v> oxfmt@<v>   (fetches from the npm registry;
#     pnpm's minimumReleaseAge guard stays on, so pick versions >7 days old);
#   oxfmt --migrate prettier; oxfmt --check .; oxlint .; eslint .; prettier --check .
# No package install scripts are enabled (allowBuilds stays as in the repo).
#
# WHAT IT PRINTS
#   1. wall-clock for eslint, prettier --check, oxlint, oxfmt --check
#   2. formatting churn after `oxfmt --migrate prettier` (files + sample diff)
#   3. lint parity: eslint vs oxlint on the tree, and on a seeded fixture
#      (rules, no-param-reassign props:false, eslint-disable `-- reason`,
#      unused-disable-directive reporting)
#   4. the generated .oxfmtrc.json / .oxlintrc.json
#
# Needs: git, pnpm, node, perl (timer). Exit: 0 ok, 2 usage, 4 missing tool.
set -euo pipefail

OXLINT_VERSION="${OXLINT_VERSION:-1.87.0}"
OXFMT_VERSION="${OXFMT_VERSION:-0.72.0}"
REF="origin/main"
RUNS=3
KEEP=0
DIR=""

usage() {
  cat <<EOF
Usage: scripts/oxc-spike.sh [--ref REF] [--runs N] [--dir DIR] [--keep]

  --ref REF   git ref to archive and test (default: origin/main)
  --runs N    timing runs per tool (default: 3)
  --dir DIR   scratch directory (default: a new mktemp dir; must not exist or be empty)
  --keep      keep the scratch directory (default: removed on exit)
  -h, --help  show this help

Env: OXLINT_VERSION (default $OXLINT_VERSION), OXFMT_VERSION (default $OXFMT_VERSION).
Fetches oxlint/oxfmt from npm into the scratch copy only. Adopts nothing.
EOF
}

need() {
  [ "$#" -ge 2 ] || {
    echo "$1 needs a value" >&2
    exit 2
  }
  printf "%s" "$2"
}
while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --ref)
      REF="$(need "$@")"
      shift 2
      ;;
    --runs)
      RUNS="$(need "$@")"
      shift 2
      ;;
    --dir)
      DIR="$(need "$@")"
      shift 2
      ;;
    --keep)
      KEEP=1
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for tool in git pnpm node perl; do
  command -v "$tool" >/dev/null || {
    echo "missing tool: $tool" >&2
    exit 4
  }
done

REPO="$(git rev-parse --show-toplevel)"
CREATED=1 # only remove a scratch dir this script created
if [ -z "$DIR" ]; then
  DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxc-spike.XXXXXX")"
elif [ -d "$DIR" ]; then
  CREATED=0
fi
mkdir -p "$DIR"
if [ -n "$(ls -A "$DIR")" ]; then
  echo "scratch dir not empty: $DIR" >&2
  exit 2
fi
cleanup() {
  if [ "$KEEP" -eq 1 ]; then
    echo "kept: $DIR"
  elif [ "$CREATED" -eq 1 ]; then
    rm -rf "$DIR"
  else
    rm -rf "$DIR/src" "$DIR/orig"
  fi
}
trap cleanup EXIT INT TERM

SRC="$DIR/src"
mkdir -p "$SRC"
git -C "$REPO" archive "$REF" | tar -x -C "$SRC"
cd "$SRC"
BIN="$SRC/node_modules/.bin"

echo "== setup: ref=$REF ($(git -C "$REPO" rev-parse --short "$REF")) oxlint@$OXLINT_VERSION oxfmt@$OXFMT_VERSION"
pnpm install --frozen-lockfile >/dev/null
pnpm add -Dw "oxlint@$OXLINT_VERSION" "oxfmt@$OXFMT_VERSION" >/dev/null
"$BIN/oxlint" --version | tr -d '\n'
echo
"$BIN/oxfmt" --version | tr -d '\n'
echo
echo "load at start: $(uptime | sed 's/.*load averages*: //')"

now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }
# timeit LABEL CMD... : RUNS runs, output discarded, exit code ignored
declare -a TIMES=()
timeit() {
  local label="$1" i t0 t1 all=""
  shift
  for ((i = 0; i < RUNS; i++)); do
    t0="$(now)"
    "$@" >/dev/null 2>&1 || true
    t1="$(now)"
    all="$all $(perl -e "printf '%.2f', $t1 - $t0")"
  done
  TIMES+=("$label:$all")
}

# ---- format ---------------------------------------------------------------
"$BIN/oxfmt" --migrate prettier >/dev/null 2>&1
timeit "prettier --check ." "$BIN/prettier" --check .
timeit "oxfmt --check ." "$BIN/oxfmt" --check .

echo
echo "== 2. formatting churn"
PRETTIER_BAD="$("$BIN/prettier" --check . 2>&1 | grep -c '^\[warn\] [^ ]*$' || true)"
"$BIN/oxfmt" --check . >../oxfmt-check.txt 2>&1 || true
grep -E '^[^ ].* \([0-9]+ms\)$' ../oxfmt-check.txt | sed 's/ ([0-9]*ms)$//' >../flagged.txt || true
TOTAL="$(grep -oE 'on [0-9]+ files' ../oxfmt-check.txt | grep -oE '[0-9]+' || echo '?')"
echo "prettier --check flags (excl. summary line): $PRETTIER_BAD files"
echo "oxfmt --check flags: $(wc -l <../flagged.txt | tr -d ' ') of $TOTAL files"
echo "by extension:"
sed 's/.*\.//' ../flagged.txt | sort | uniq -c | sort -rn
mkdir -p ../orig
while read -r f; do
  mkdir -p "../orig/$(dirname "$f")"
  cp "$f" "../orig/$f"
done <../flagged.txt
xargs "$BIN/oxfmt" --write <../flagged.txt >/dev/null 2>&1 || true
echo "changed lines per file (added+removed):"
while read -r f; do
  echo "$(diff -u "../orig/$f" "$f" | grep -c '^[-+][^-+]') $f"
done <../flagged.txt | sort -rn
echo "--- sample diffs ---"
while read -r f; do diff -u "../orig/$f" "$f" | head -24 || true; done < <(head -8 ../flagged.txt)
# restore the tree so the lint timings below see pristine sources
while read -r f; do cp "../orig/$f" "$f"; done <../flagged.txt

# ---- lint -----------------------------------------------------------------
cat >.oxlintrc.json <<'EOF'
{
  "plugins": ["typescript"],
  "categories": { "correctness": "off" },
  "ignorePatterns": [
    "dist/**", "node_modules/**", ".claude/worktrees/**", "site/**", "coverage/**",
    "**/*.html", "editor/css/**", "editor/__tests__/**", "examples/**", "public/**",
    "packages/site/samples-data.ts", "packages/site/xychart-samples-data.ts",
    "scripts/*.workflow.mjs"
  ],
  "overrides": [
    {
      "files": ["**/*.ts", "**/*.tsx"],
      "rules": {
        "no-var": "error",
        "prefer-const": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
        "no-param-reassign": ["error", { "props": false }],
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
        "no-unused-expressions": "error",
        "no-array-constructor": "error",
        "typescript/ban-ts-comment": "error",
        "typescript/no-duplicate-enum-values": "error",
        "typescript/no-empty-object-type": "error",
        "typescript/no-explicit-any": "error",
        "typescript/no-extra-non-null-assertion": "error",
        "typescript/no-misused-new": "error",
        "typescript/no-namespace": "error",
        "typescript/no-non-null-asserted-optional-chain": "error",
        "typescript/no-require-imports": "error",
        "typescript/no-this-alias": "error",
        "typescript/no-unnecessary-type-constraint": "error",
        "typescript/no-unsafe-declaration-merging": "error",
        "typescript/no-unsafe-function-type": "error",
        "typescript/no-wrapper-object-types": "error",
        "typescript/prefer-as-const": "error",
        "typescript/prefer-namespace-keyword": "error",
        "typescript/triple-slash-reference": "error"
      }
    }
  ]
}
EOF
timeit "eslint ." "$BIN/eslint" .
timeit "oxlint ." "$BIN/oxlint" .

echo
echo "== 3. lint parity"
"$BIN/eslint" -f json . >../es-tree.json 2>/dev/null || true
"$BIN/oxlint" -f json . >../ox-tree.json 2>/dev/null || true
node - ../es-tree.json ../ox-tree.json <<'EOF'
const fs = require('fs')
const es = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).flatMap((f) => f.messages)
const ox = (JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).diagnostics ?? [])
console.log(`tree: eslint ${es.length} problems, oxlint ${ox.length} problems`)
EOF

# Seeded fixture: one violation per rule, plus the directive-comment cases.
cat >scripts/zz-fixture.ts <<'EOF'
/// <reference path="./x.d.ts" />
// @ts-ignore
var a = 1
let b = 2
export function f(p: number, _q: number, o: { x: number }) {
  p = 3
  o.x = 4 // PROPS_FALSE: must NOT be flagged
  const unused = 1
  const _ok = 2
  try {
    b++
  } catch (e) {}
  a
  return arguments
}
export const g = (x: any): Function => x
export namespace N {}
export interface Empty {}
export enum E { A = 1, B = 1 }
export const arr = new Array(1, 2)
export const c = 'a' as 'a'
export function h<T extends unknown>(t: T) {
  return (t as any)?.x!.y
}
const t = require('fs')
export class K { constructor() {} }
export interface I2 { new (): I2 }
export const s: String = 'x'
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented reason
export const d1 = (x: any) => x
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const d2 = (x: any) => x
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- STALE_ESLINT
export const d3 = 1
// oxlint-disable-next-line typescript/no-explicit-any
export const d4 = (x: any) => x
export class M { m() { const self = this; return self } }
export interface M { y: number }
export function z(o?: { a: { b: number } }) { return [o?.a!.b, o!!.a] }
export module Mod { export const q = 1 }
export { t }
EOF
"$BIN/eslint" -f json scripts/zz-fixture.ts >../es-fix.json 2>/dev/null || true
"$BIN/oxlint" -f json --report-unused-disable-directives-severity=error scripts/zz-fixture.ts >../ox-fix.json 2>/dev/null || true
node - ../es-fix.json ../ox-fix.json <<'EOF'
const fs = require('fs')
const es = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))[0].messages
const ox = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).diagnostics
const norm = (r) => (r || 'unused-disable-directive').replace(/^@typescript-eslint\//, '').replace(/^.*\((.*)\)$/, '$1')
const line = (d) => d.labels?.[0]?.span?.line
const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())
const ec = count(es.map((m) => norm(m.ruleId)))
const oc = count(ox.map((d) => norm(d.code)))
console.log(`fixture: eslint ${es.length} problems, oxlint ${ox.length} problems; rules whose counts differ:`)
for (const r of [...new Set([...ec.keys(), ...oc.keys()])].sort()) {
  if (ec.get(r) !== oc.get(r)) console.log(`  ${r}: eslint ${ec.get(r) ?? 0}, oxlint ${oc.get(r) ?? 0}`)
}
console.log(`  (rules in both with equal counts: ${[...ec.keys()].filter((r) => ec.get(r) === oc.get(r)).length})`)
const lineOf = (needle) => fs.readFileSync('scripts/zz-fixture.ts', 'utf8').split('\n').findIndex((l) => l.includes(needle)) + 1
console.log(`no-param-reassign props:false honoured (o.x= not flagged): ${!ox.some((d) => line(d) === lineOf('PROPS_FALSE'))}`)
console.log(`eslint-disable w/ '-- reason' suppresses in oxlint: ${!ox.some((d) => line(d) === lineOf('d1 ='))}; plain eslint-disable suppresses: ${!ox.some((d) => line(d) === lineOf('d2 ='))}`)
console.log(`stale eslint-disable w/ '-- reason' reported by oxlint (severity=error flag): ${ox.some((d) => line(d) === lineOf('STALE_ESLINT') && d.severity === 'error')}`)
console.log(`oxlint-disable (d4) is ignored by eslint, so eslint flags it: ${es.some((m) => m.line === lineOf('d4 =') && m.ruleId)}`)
EOF
rm scripts/zz-fixture.ts

echo
echo "== 1. wall-clock seconds ($RUNS runs each; whole repo; direct binaries, no pnpm wrapper)"
for row in "${TIMES[@]}"; do echo "  $row"; done
echo "load at end: $(uptime | sed 's/.*load averages*: //')"

echo
echo "== 4. generated config"
cat .oxfmtrc.json
