#!/usr/bin/env bash
# Warn-only pre-flight for `gh pr create` (#1583): flags the PR-process misses
# this repo keeps hitting, from the branch's diff against origin/main.
# Run by the PreToolUse hook in .claude/settings.json (--hook), or by hand.
# Never blocks: always exits 0 unless --strict is given.
set -euo pipefail

EXIT_OK=0
EXIT_WARNINGS=1
EXIT_USAGE=2
EXIT_DEPENDENCY=4

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-h|--help] [--hook] [--strict] [--base REF] [--body-file FILE]

Warns about likely PR-process misses, from the diff of HEAD against REF
(default origin/main):
  - ASCII-renderer paths changed, but the PR body has no image (real-terminal
    screenshot flow: verify-ascii-terminal skill)
  - published code changed with no .changeset/*.md
  - a changeset on a PR that touches no published code
  - docs/decisions/*.md changed (self-review checklist link)
  - rendered-output bug fix without demo/fork-fixes-data.ts

  --hook         read a PreToolUse JSON payload on stdin; do nothing unless
                 the command is 'gh pr create'; emit warnings as hook
                 additionalContext (also takes --body-file from the command)
  --strict       exit $EXIT_WARNINGS when there are warnings (default: always $EXIT_OK)
  --base REF     diff base (default origin/main)
  --body-file F  PR body file, checked for a screenshot

Exit codes: $EXIT_OK ok (or warn-only), $EXIT_WARNINGS warnings with --strict,
$EXIT_USAGE usage error, $EXIT_DEPENDENCY missing git/jq.
EOF
}

hook=0 strict=0 base=origin/main body_file=""
while [ "$#" -gt 0 ]; do
  case "$1" in
  -h | --help)
    usage
    exit "$EXIT_OK"
    ;;
  --hook) hook=1 ;;
  --strict) strict=1 ;;
  --base)
    base="${2:?--base needs a value}"
    shift
    ;;
  --body-file)
    body_file="${2:?--body-file needs a value}"
    shift
    ;;
  *)
    printf '%s: unknown argument %s (see --help)\n' "$SCRIPT_NAME" "$1" >&2
    exit "$EXIT_USAGE"
    ;;
  esac
  shift
done

for cmd in git jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    printf '%s: %s not on PATH\n' "$SCRIPT_NAME" "$cmd" >&2
    exit "$EXIT_DEPENDENCY"
  }
done

body=""
if [ "$hook" -eq 1 ]; then
  cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null || true)"
  printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)' || exit "$EXIT_OK"
  body_file="$(printf '%s' "$cmd" | sed -nE 's/.*--body-file[ =]+"?([^" ]+)"?.*/\1/p' | head -n1)"
  body="$cmd" # inline --body text is part of the command itself
fi
if [ -n "$body_file" ] && [ -r "$body_file" ]; then
  body="$body$(cat "$body_file")"
fi

top="$(git rev-parse --show-toplevel 2>/dev/null)" || exit "$EXIT_OK"
cd "$top"
git rev-parse --verify -q "$base" >/dev/null || exit "$EXIT_OK" # no base to compare: stay quiet
files="$(git diff --name-only "$base"...HEAD)"
[ -n "$files" ] || exit "$EXIT_OK"
subjects="$(git log --format=%s "$base"..HEAD)"

warnings=()
has() { printf '%s\n' "$files" | grep -Eq "$1"; }

# Published code = src/ or packages/<pkg>/src/, excluding tests.
has_code=0
if printf '%s\n' "$files" | grep -E '^(src|packages/[^/]+/src)/' | grep -Ev '(__tests__|\.test\.)' | grep -q .; then
  has_code=1
fi
has_changeset=0
if has '^\.changeset/.+\.md$'; then has_changeset=1; fi

if has '^(packages/ascii-renderer/|packages/site/ascii-html\.ts|src/cli\.ts|scripts/visual-diff\.ts)'; then
  printf '%s' "$body" | grep -Eq '!\[|user-attachments|<img' ||
    warnings+=("ASCII output paths changed but the PR body has no screenshot. Use the verify-ascii-terminal skill (real-terminal capture, never the Playwright/HTML mockup) and paste the mermaid source under the Visual verification heading.")
fi
if [ "$has_code" -eq 1 ] && [ "$has_changeset" -eq 0 ]; then
  warnings+=("Published code changed but no .changeset/*.md is added (see CONTRIBUTING.md Changesets; never bump versions or edit CHANGELOG).")
fi
if [ "$has_code" -eq 0 ] && [ "$has_changeset" -eq 1 ]; then
  warnings+=("A changeset is included but no published code (src/, packages/*/src/) changed; data/docs-only PRs should not carry one.")
fi
if has '^docs/decisions/.+\.md$'; then
  warnings+=("docs/decisions/*.md changed: walk the self-review checklist first, docs/decisions/decision-doc-self-review-checklist-977.md")
fi
if printf '%s\n' "$subjects" | grep -Eiq '^fix' &&
  has '^packages/(svg|ascii)-renderer/src/' && ! has '^demo/fork-fixes-data\.ts$'; then
  warnings+=("Looks like a rendered-output bug fix but demo/fork-fixes-data.ts is untouched; add an entry or say why not (CONTRIBUTING.md 'Adding a fork-fixes entry').")
fi

[ "${#warnings[@]}" -gt 0 ] || exit "$EXIT_OK"

msg="pre-pr-check warnings (non-blocking):"
for w in "${warnings[@]}"; do msg="$msg"$'\n'"- $w"; done
if [ "$hook" -eq 1 ]; then
  jq -n --arg m "$msg" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$m}}'
else
  printf '%s\n' "$msg" >&2
fi
if [ "$strict" -eq 1 ]; then exit "$EXIT_WARNINGS"; fi
exit "$EXIT_OK"
