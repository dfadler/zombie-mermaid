#!/usr/bin/env bash
# Warn-only PreToolUse hook (#2003): nudges when a Write creates a new file under
# docs/research/, before the file exists. pre-pr-check.sh warns later, at PR time.
# Run by .claude/settings.json (matcher Write); reads the hook JSON on stdin.
# Never blocks: always exits 0 unless a dependency is missing.
set -euo pipefail

EXIT_OK=0
EXIT_USAGE=2
EXIT_DEPENDENCY=4

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-h|--help]

Reads a PreToolUse JSON payload on stdin. If the tool call writes a file that
does not exist yet under docs/research/ (other than README.md), prints hook
additionalContext telling the agent to post the findings as an issue comment
instead (CLAUDE.md 'Research and measurement', #1642). Silent otherwise.

Exit codes: $EXIT_OK ok (always, warn-only), $EXIT_USAGE usage error,
$EXIT_DEPENDENCY jq missing.
EOF
}

case "${1:-}" in
-h | --help)
  usage
  exit "$EXIT_OK"
  ;;
"") ;;
*)
  printf '%s: unknown argument %s (see --help)\n' "$SCRIPT_NAME" "$1" >&2
  exit "$EXIT_USAGE"
  ;;
esac

command -v jq >/dev/null 2>&1 || {
  printf '%s: jq not on PATH\n' "$SCRIPT_NAME" >&2
  exit "$EXIT_DEPENDENCY"
}

path="$(jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
case "$path" in
*/docs/research/README.md | docs/research/README.md) exit "$EXIT_OK" ;;
*/docs/research/* | docs/research/*) ;;
*) exit "$EXIT_OK" ;;
esac
[ ! -e "$path" ] || exit "$EXIT_OK" # editing an existing kept doc is fine

jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:"New file under docs/research/: post the findings as a comment on the issue instead (long ones in <details>, with a permalink to any script), and end the investigation with that comment. Keep a doc here only if a guide, code comment or script links to it and it is worth keeping current (CLAUDE.md \"Research and measurement\", #1642)."}}'
exit "$EXIT_OK"
