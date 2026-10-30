#!/usr/bin/env bash
# PreToolUse Bash guard for outbound GitHub actions (#1611, #1608).
#  - DENY (unchanged from the former inline hook): PR create/ready/merge or
#    /pulls API calls naming lukilabs/beautiful-mermaid, and `git push upstream`.
#  - WARN (new, never blocks): `gh pr create`, `gh issue create` or `git push`
#    aimed at a repo/remote whose owner is not in the allowlist. The allowlist
#    is the owner of `origin` plus REMOTE_GUARD_OWNED (space-separated owners).
# Hook mode reads the PreToolUse JSON on stdin; emits JSON only on deny/warn.
set -uo pipefail

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-h|--help]

Reads a PreToolUse JSON payload on stdin (.tool_input.command). Prints a hook
JSON decision only when it denies (upstream PR/push) or warns (gh pr create,
gh issue create, git push at a non-owned repo or remote). Otherwise silent.
Always exits 0. Needs jq and git; env REMOTE_GUARD_OWNED adds owners.
EOF
}

case "${1:-}" in
-h | --help)
  usage
  exit 0
  ;;
esac

command -v jq >/dev/null 2>&1 || exit 0
c="$(jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -n "$c" ] || exit 0

emit() { # emit <deny|ctx> <message>
  if [ "$1" = deny ]; then
    jq -n --arg m "$2" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$m}}'
  else
    jq -n --arg m "$2" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$m}}'
  fi
  exit 0
}

# --- deny rules (moved from the inline hook; first line only, as before in .claude/settings.json) ---
IFS=$' \t\n' read -r first <<<"$c" # the old hook's `read -r`: line 1 only, leading blanks stripped
if printf '%s' "$first" | grep -qi 'lukilabs' && printf '%s' "$first" | grep -qi 'beautiful-mermaid'; then
  if printf '%s' "$first" | grep -Eiq '(gh[[:space:]]+pr[[:space:]]+(create|ready|merge)|/pulls([^a-zA-Z]|$)|api[[:space:]].*pulls)'; then
    emit deny "Blocked: this command submits or modifies a PR on the upstream fork-parent repo (lukilabs/beautiful-mermaid). PRs must target the fork (origin, dfadler/zombie-mermaid) only."
  fi
fi
if printf '%s' "$first" | grep -Eiq '^git[[:space:]]+push([[:space:]]+--[a-zA-Z-]+)*[[:space:]]+upstream\b'; then
  emit deny "Blocked: pushing to the upstream remote (lukilabs/beautiful-mermaid) is not allowed. Push to origin (your fork) instead."
fi

# --- warn-only allowlist guard ---
owner_of() { # owner from an https/ssh remote URL or owner/repo slug
  printf '%s' "$1" | sed -E 's#\.git$##; s#/+$##' | awk -F'[:/]' 'NF>=2 {print tolower($(NF-1))}'
}
origin_url="$(git remote get-url origin 2>/dev/null || true)"
owned=" $(owner_of "$origin_url") $(printf '%s' "${REMOTE_GUARD_OWNED:-}" | tr '[:upper:]' '[:lower:]') "

warnings=()
check() { # check <what> <target-slug-or-url>
  local o
  o="$(owner_of "$2")"
  [ -n "$o" ] || return 0
  case "$owned" in
  *" $o "*) ;;
  *) warnings+=("$1 targets '$2' (owner '$o'), which is not an owned repo. Confirm this is intended; set REMOTE_GUARD_OWNED to allow more owners.") ;;
  esac
}

push_target() { # remote git push uses when none is named: branch pushRemote, pushDefault, branch remote, origin
  local b r
  b="$(git symbolic-ref -q --short HEAD 2>/dev/null || true)"
  r="$(git config --get "branch.$b.pushRemote" 2>/dev/null || git config --get remote.pushDefault 2>/dev/null || git config --get "branch.$b.remote" 2>/dev/null || true)"
  printf '%s' "${r:-origin}"
}
gh_default() { # gh's default repo without --repo: GH_REPO, then remote.<n>.gh-resolved, then origin
  local line n v
  if [ -n "${1:-}" ]; then
    printf '%s' "$1"
    return
  fi
  line="$(git config --get-regexp '^remote\..*\.gh-resolved$' 2>/dev/null | head -n1)"
  if [ -n "$line" ]; then
    n="${line%% *}"
    v="${line#* }"
    n="${n#remote.}"
    n="${n%.gh-resolved}"
    if [ "$v" = base ]; then
      git remote get-url "$n" 2>/dev/null && return
    else
      printf '%s' "$v"
      return
    fi
  fi
  printf '%s' "$origin_url"
}

while IFS= read -r seg; do
  read -ra t <<<"$seg"
  envrepo="${GH_REPO:-}"
  # Leading NAME=value assignments don't change which command runs; GH_REPO changes its target.
  while [ "${#t[@]}" -gt 0 ] && [[ "${t[0]}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do
    case "${t[0]}" in GH_REPO=*) envrepo="${t[0]#GH_REPO=}" ;; esac
    t=("${t[@]:1}")
  done
  [ "${#t[@]}" -ge 2 ] || continue
  kind=""
  if [ "${t[0]}" = gh ] && [ "${t[1]}" = pr ] && [ "${t[2]:-}" = create ]; then kind="gh pr create"; fi
  if [ "${t[0]}" = gh ] && [ "${t[1]}" = issue ] && [ "${t[2]:-}" = create ]; then kind="gh issue create"; fi
  if [ "${t[0]}" = git ] && [ "${t[1]}" = push ]; then kind="git push"; fi
  [ -n "$kind" ] || continue
  repo="" remote=""
  for ((i = 2; i < ${#t[@]}; i++)); do
    a="${t[i]//[\"\']/}"
    case "$a" in
    -o | --push-option | --receive-pack | --exec) [ "$kind" = "git push" ] && i=$((i + 1)) ;; # skip the option's value
    --repo | -R) repo="${t[i + 1]//[\"\']/}" ;;
    --repo=*) repo="${a#--repo=}" ;;
    -*) ;;
    *) [ "$kind" = "git push" ] && [ -z "$remote" ] && remote="$a" ;;
    esac
  done
  if [ "$kind" = "git push" ]; then
    r="${remote:-$(push_target)}"
    case "$r" in
    *://* | *@*:* | */*) url="$r" ;;
    *) url="$(git remote get-url --push "$r" 2>/dev/null || true)" ;;
    esac
    [ -n "$url" ] && check "$kind (remote '$r')" "$url"
  elif [ -n "$repo" ]; then
    check "$kind" "$repo"
  else
    target="$(gh_default "$envrepo")"
    [ -n "$target" ] && check "$kind (default repo)" "$target"
  fi
done < <(printf '%s\n' "$c" | tr ';&|' '\n' | sed -E 's/^[[:space:]]+//')

[ "${#warnings[@]}" -gt 0 ] || exit 0
msg="remote-guard warning (non-blocking):"
for w in "${warnings[@]}"; do msg="$msg"$'\n'"- $w"; done
emit ctx "$msg"
