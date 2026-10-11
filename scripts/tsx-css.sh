#!/usr/bin/env bash
set -uo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/tsx-css.sh <file.ts> [args...]

Runs `tsx <file.ts> [args...]` with zombie-mermaid#1103's .module.css
loader hook registered via NODE_OPTIONS, so a site generator can resolve a
plain `import styles from './x.module.css'`. Centralizes the
`NODE_OPTIONS="--import ./scripts/css-module-register.mjs"` prefix every
package.json site-generator script needs, instead of repeating it
per-script.
EOF
}

EXIT_OK=0
EXIT_USAGE=2

if [[ $# -eq 0 ]]; then
  usage >&2
  exit "$EXIT_USAGE"
fi

if [[ $1 == "-h" || $1 == "--help" ]]; then
  usage
  exit "$EXIT_OK"
fi

hook_import="--import ./scripts/css-module-register.mjs"
export NODE_OPTIONS="${hook_import}${NODE_OPTIONS:+ $NODE_OPTIONS}"

exec tsx "$@"
