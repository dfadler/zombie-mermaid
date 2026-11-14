# Shared Playwright Docker image for visual regression: no adopt yet

Status: partially superseded (see the amendments below for which half won)

## Decision

- Original call (2026-09-06): no adopt yet; full and partial adoption were both unsupported by the measurements.
- Amendment 2026-09-07: the ASCII half is proven by the font fix; SVG still rested on an amd64 proxy.
- Amendment 2026-09-09: #545 closed, architecture ruled out (arm64 matched same-commit CI).
- #551 answered: keep the `-linux`/`-darwin` split and the current baseline scheme; no consolidation, no architecture-based rename (SVG samples differ from native macOS because of font fallback).

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/544#issuecomment-6884736943
