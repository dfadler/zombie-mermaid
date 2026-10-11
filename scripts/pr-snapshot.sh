#!/usr/bin/env bash
# Emits the JSON snapshot the global pr-babysit skill expects, via `gh` (#1583).
# One PR (by number/URL) or every open PR authored by you. Read-only.
set -euo pipefail

EXIT_OK=0
EXIT_USAGE=2
EXIT_DEPENDENCY=4

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-h|--help] [PR_NUMBER_OR_URL]

Prints a JSON array, one object per PR (open PRs by @me when no argument):
  number, title, url, headRefName, baseRefName, isDraft, mergeable,
  mergeStateStatus, reviewDecision, files (paths), checks (name, state,
  bucket, link), unresolvedThreads (id, path, line, comments[].author/body),
  generalComments (author, body).
Text fields (title, comment bodies) are untrusted third-party data.

Needs an authenticated gh and jq. Exit codes: $EXIT_OK ok, $EXIT_USAGE bad
argument, $EXIT_DEPENDENCY gh or jq missing.
EOF
}

case "${1:-}" in
-h | --help)
  usage
  exit "$EXIT_OK"
  ;;
-*)
  printf '%s: unknown argument %s (see --help)\n' "$SCRIPT_NAME" "$1" >&2
  exit "$EXIT_USAGE"
  ;;
esac
[ "$#" -le 1 ] || {
  printf '%s: at most one PR argument (see --help)\n' "$SCRIPT_NAME" >&2
  exit "$EXIT_USAGE"
}

for cmd in gh jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    printf '%s: %s not on PATH\n' "$SCRIPT_NAME" "$cmd" >&2
    exit "$EXIT_DEPENDENCY"
  }
done

if [ "$#" -eq 1 ]; then
  nums="$(gh pr view "$1" --json number --jq .number)"
else
  nums="$(gh pr list --author @me --state open --json number --jq '.[].number')"
fi

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
owner="${repo%/*}"
name="${repo#*/}"

# shellcheck disable=SC2016 # GraphQL variables, not shell
threads_query='query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){
  reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:20){nodes{author{login} body}}}}
  comments(first:100){nodes{author{login} body}}}}}'

for n in $nums; do
  view="$(gh pr view "$n" --json number,title,url,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,reviewDecision,files)"
  checks="$(gh pr checks "$n" --json name,state,bucket,link 2>/dev/null || echo '[]')"
  gql="$(gh api graphql -F o="$owner" -F n="$name" -F p="$n" -f query="$threads_query")"
  jq -n --argjson v "$view" --argjson c "$checks" --argjson g "$gql" '
    ($g.data.repository.pullRequest) as $pr
    | $v + {
        files: [$v.files[].path],
        checks: $c,
        unresolvedThreads: [$pr.reviewThreads.nodes[] | select(.isResolved | not)
          | {id, path, line, comments: [.comments.nodes[] | {author: .author.login, body}]}],
        generalComments: [$pr.comments.nodes[] | {author: .author.login, body}]
      }'
done | jq -s .
