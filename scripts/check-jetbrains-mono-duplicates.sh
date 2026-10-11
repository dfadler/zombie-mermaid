#!/usr/bin/env bash
# Warns if this Mac has both a variable JetBrains Mono font file and
# separate static weight instances installed under the same family name.
#
# WHY THIS EXISTS
#
# macOS's font matching can resolve `font-family: 'JetBrains Mono'` (used
# for class-diagram code text in the renderer) to either the variable font
# file (e.g. `JetBrainsMono[wght].ttf`) or one of the separate static weight
# instances (`JetBrainsMono-Regular.ttf`, etc.) when both are installed -
# and the two have measurably different glyph metrics. That shifts text
# width/height just enough to make a broad, uniform-looking swath of
# `-chromium-darwin.png` visual-regression baselines fail locally with no
# real regression involved (issue #551, issue #849; see CONTRIBUTING.md's
# "Visual regression tests" section, darwin caveat).
#
# The clash is per family: JetBrainsMono and JetBrainsMonoNL are different
# families, so a variable JetBrainsMono next to static JetBrainsMonoNL files is
# not a duplicate. Files are grouped by family before comparing.
#
# This is a macOS-only, contributor-machine-local concern - not something CI
# can check - so run it manually as a pre-flight step before generating or
# comparing local `-darwin` baselines. It is informational, not a CI gate.
set -euo pipefail

EXIT_OK=0
EXIT_FAILURE=1
EXIT_USAGE=2

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<'EOF'
Usage: scripts/check-jetbrains-mono-duplicates.sh [-h|--help]

Checks whether this Mac has both a variable JetBrains Mono font file and
separate static weight instances installed under the same family name - a
confirmed cause of local `-chromium-darwin.png` visual-regression baseline
noise that looks like a real regression but isn't (see CONTRIBUTING.md's
darwin caveat, issue #849).

Scans the standard macOS font directories (/Library/Fonts,
/System/Library/Fonts, /System/Library/Fonts/Supplemental, and
~/Library/Fonts) for files named like JetBrains Mono - the same set Font
Book and the OS's own font matcher draw from - and classifies each as
"variable" or "static" by filename. Equivalent to eyeballing
`fc-list | grep -i jetbrains` for duplicate family entries, or the
duplicate-font warning in macOS Font Book, but works without fontconfig
installed.

A clash is a variable and a static file of the SAME family, for example
variable JetBrainsMono with static JetBrainsMono-Regular. A different family
(JetBrainsMonoNL) next to it does not count.

Run this before generating or comparing local -darwin baselines. It is
NOT wired into CI or any npm script as a hard gate: this is a macOS-only,
contributor-machine-local concern, not something a Linux CI runner has or
needs to check.

Options:
  -h, --help   Show this help and exit.

Environment:
  FONT_DIRS    Colon-separated list of directories to scan, overriding the
               standard macOS font directories above (mainly for testing).

Exit codes: 0 no duplicate found (including: not on macOS, nothing to
check); 1 a variable + static duplicate install was found; 2 usage error.
EOF
}

for arg in "$@"; do
  case "$arg" in
  -h | --help)
    usage
    exit "$EXIT_OK"
    ;;
  *)
    printf '%s: unknown argument %s (see --help)\n' "$SCRIPT_NAME" "$arg" >&2
    exit "$EXIT_USAGE"
    ;;
  esac
done

# Only macOS's font matcher exhibits this symptom - nothing to check
# elsewhere. Testable via UNAME_S_OVERRIDE without needing to run on macOS.
os_name="${UNAME_S_OVERRIDE:-$(uname -s)}"
if [ "$os_name" != "Darwin" ]; then
  printf '%s: not on macOS (uname -s: %s) - nothing to check.\n' "$SCRIPT_NAME" "$os_name"
  exit "$EXIT_OK"
fi

default_font_dirs="/Library/Fonts:/System/Library/Fonts:/System/Library/Fonts/Supplemental:${HOME}/Library/Fonts"
font_dirs="${FONT_DIRS:-$default_font_dirs}"

# Static weight instances name the weight (and optionally Italic) in the
# filename; a plain `-Italic` file is the static Regular Italic. The variable
# font instead carries a `[wght]` (or "VariableFont") marker and no weight
# suffix.
static_weight_pattern='-((Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black)(Italic)?|Italic)\.(ttf|otf)$'
variable_marker_pattern='(\[wght\]|VariableFont)'

# Reduce a filename to its lowercased family: JetBrainsMono[wght].ttf,
# JetBrainsMono-Italic[wght].ttf and JetBrainsMono-Bold.ttf are all
# "jetbrainsmono"; JetBrainsMonoNL-Regular.ttf is "jetbrainsmononl".
family_of() {
  printf '%s' "$1" |
    sed -E \
      -e 's/\.(ttf|otf)$//' \
      -e 's/(-Italic)?(\[wght\]|-?VariableFont.*)$//' \
      -e 's/-((Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black)(Italic)?|Italic)$//' |
    tr '[:upper:]' '[:lower:]'
}

# One tab-separated "family kind path" line per classified file, and the
# paths of files that could not be classified. Plain strings rather than
# arrays: macOS ships bash 3.2, where expanding an empty array under `set -u`
# is an "unbound variable" error.
records=""
others=""

IFS=':' read -r -a dirs <<<"$font_dirs"
for dir in ${dirs[@]+"${dirs[@]}"}; do
  [ -d "$dir" ] || continue
  while IFS= read -r -d '' file; do
    basename_file="$(basename "$file")"
    if [[ "$basename_file" =~ $variable_marker_pattern ]]; then
      records+="$(family_of "$basename_file")"$'\t'"variable"$'\t'"$file"$'\n'
    elif [[ "$basename_file" =~ $static_weight_pattern ]]; then
      records+="$(family_of "$basename_file")"$'\t'"static"$'\t'"$file"$'\n'
    else
      others+="$file"$'\n'
    fi
  done < <(find "$dir" -maxdepth 1 -type f -iname '*jetbrainsmono*' -print0 2>/dev/null)
done

# Families that have both a variable and a static file.
clash_families="$(
  printf '%s' "$records" |
    awk -F'\t' '
      { seen[$1 SUBSEP $2] = 1; fam[$1] = 1 }
      END { for (f in fam) if (seen[f SUBSEP "variable"] && seen[f SUBSEP "static"]) print f }' |
    sort
)"

if [ -n "$clash_families" ]; then
  printf '%s: found both a variable and static install of the same JetBrains Mono family - this is a confirmed cause of spurious -chromium-darwin.png visual-regression failures (issue #551, issue #849).\n' "$SCRIPT_NAME" >&2
  while IFS= read -r family; do
    printf '\nFamily "%s":\n  Variable font file(s):\n' "$family" >&2
    printf '%s' "$records" | awk -F'\t' -v f="$family" '$1 == f && $2 == "variable" { print "    " $3 }' >&2
    printf '  Static weight file(s):\n' >&2
    printf '%s' "$records" | awk -F'\t' -v f="$family" '$1 == f && $2 == "static" { print "    " $3 }' >&2
  done <<<"$clash_families"
  printf '\nFix: for each family above, remove the static weight files (typically the ones to delete,\nkeeping the variable font) or vice versa, so only one instance of the\nfamily remains installed, then re-run this check. See CONTRIBUTING.md'"'"'s\nvisual-regression darwin caveat for detail.\n' >&2
  exit "$EXIT_FAILURE"
fi

if [ -n "$others" ] && [ -n "$records" ]; then
  printf '%s: found JetBrains Mono file(s) this script could not classify by filename alongside a classified one - inspect manually:\n' "$SCRIPT_NAME" >&2
  printf '%s' "$others" | sed 's/^/  /' >&2
  printf '%s' "$records" | awk -F'\t' '{ print "  " $3 }' >&2
fi

printf '%s: no variable+static JetBrains Mono duplicate install found.\n' "$SCRIPT_NAME"
exit "$EXIT_OK"
