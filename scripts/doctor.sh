#!/usr/bin/env bash
# Check the local toolchain. Core tools are required; ASCII/Docker tools are
# optional (only needed for real-terminal captures and visual baselines).
set -uo pipefail

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  echo "Usage: pnpm run doctor"
  exit 0
fi

bad=0
ok() { echo "ok       $1"; }
req() { echo "MISSING  $1"; bad=1; }
opt() { echo "optional $1 (not found)"; }

major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -ge 24 ]; then ok "node $(node -v)"; else req "node >=24 (found $(node -v 2>/dev/null || echo none))"; fi
if command -v pnpm >/dev/null; then ok "pnpm $(pnpm -v)"; else req "pnpm"; fi

if ls "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"/chromium* "$HOME/.cache/ms-playwright"/chromium* >/dev/null 2>&1; then
  ok "playwright chromium"
else
  opt "playwright chromium (run: pnpm exec playwright install chromium)"
fi
for t in asciinema agg docker; do
  if command -v "$t" >/dev/null; then ok "$t"; else opt "$t"; fi
done
if command -v fc-list >/dev/null && fc-list | grep -qi 'JetBrains Mono'; then
  ok "JetBrains Mono font"
else
  opt "JetBrains Mono font"
fi
exit "$bad"
