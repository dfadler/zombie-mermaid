#!/usr/bin/env bash
# Expiry/health check for one repo PAT (#2448, pattern from #1736).
#   PAT=<token> GH_TOKEN=<github.token> check-pat-health.sh SECRET_NAME [DOC_HINT]
# Calls GET /user and reads the GitHub-Authentication-Token-Expiration header
# (absent for a non-expiring token). Opens/comments ONE issue titled
# "<SECRET_NAME> needs attention" when the PAT is rejected (401/403) or
# expires within PAT_WARN_DAYS (default 14). Never prints the token, never
# fails the job on a broken check (exit 0); only a missing GH_TOKEN is exit 2.
set -uo pipefail
case "${1:-}" in -h | --help | '') sed -n '2,8p' "$0" && exit 0 ;; esac
name="$1"
warn_days="${PAT_WARN_DAYS:-14}"
[ -n "${PAT:-}" ] || { echo "PAT health: ${name} is unset, skipping"; exit 0; }
[ -n "${GH_TOKEN:-}" ] || { echo "::error::GH_TOKEN (issues: write) is required" >&2; exit 2; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# Header file (mktemp -d is 0700) keeps the PAT out of curl's argv.
printf 'Authorization: Bearer %s\n' "$PAT" >"$tmp/auth"
code=$(curl -sS --max-time 20 -o /dev/null -D "$tmp/headers" -w '%{http_code}' \
  -H @"$tmp/auth" "${GITHUB_API_URL:-https://api.github.com}/user") || exit 0

to_epoch() { # GNU date, else BSD date (local dev / tests on macOS)
  date -u -d "$1" +%s 2>/dev/null || date -j -u -f '%Y-%m-%d %H:%M:%S %Z' "$1" +%s 2>/dev/null
}

problem=""
if [ "$code" = 401 ] || [ "$code" = 403 ]; then
  problem="was rejected by the GitHub API (HTTP ${code}); it is probably expired or revoked."
else
  exp=$(grep -i '^github-authentication-token-expiration:' "$tmp/headers" | cut -d: -f2- | tr -d '\r' | xargs || true)
  echo "PAT health: ${name}: HTTP ${code}, expiration header: ${exp:-<absent>}"
  [ -n "$exp" ] || exit 0 # no header: non-expiring token
  exp_s=$(to_epoch "$exp") || { echo "PAT health: could not parse expiration header"; exit 0; }
  days=$(((exp_s - $(date -u +%s)) / 86400))
  echo "PAT health: ${name}: ${days} day(s) until expiry"
  [ "$days" -lt "$warn_days" ] && problem="expires in ${days} day(s) (${exp})."
fi
[ -n "$problem" ] || exit 0

echo "::warning::${name} ${problem}"
printf '%s %s\n\nRotate it: see "Rotating" for this secret in %s (tracking: #2450). Reported by %s/%s/actions/runs/%s.\n' \
  "$name" "$problem" "${2:-docs/visual-regression.md}" "${GITHUB_SERVER_URL:-}" "${GITHUB_REPOSITORY:-}" "${GITHUB_RUN_ID:-}" >"$tmp/body.md"
title="${name} needs attention"
num=$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --search "\"$title\" in:title" --json number,title \
  --jq "map(select(.title==\"$title\"))[0].number // empty")
if [ -n "$num" ]; then
  gh issue comment "$num" --repo "$GITHUB_REPOSITORY" --body-file "$tmp/body.md"
else
  gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --body-file "$tmp/body.md"
fi
exit 0
