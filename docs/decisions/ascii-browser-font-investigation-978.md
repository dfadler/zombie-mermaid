# Self-hosted ASCII/terminal font (#978): don't build one — fix the loading/CSS gaps in what's already chosen

Status: implemented

## Decision

Don't build a new font and don't bundle a CJK-capable one. Fix the loading/CSS gaps in what is already chosen:

1. Self-host JetBrains Mono NL (the ligature-free build) instead of pulling it from Google's CDN.
2. Use a subset that explicitly covers Basic Latin, Latin-1, Box Drawing (U+2500-U+257F) and Block Elements (U+2580-U+259F); Fontsource's pre-split "latin" subset does not cover box drawing.
3. Load it on every ASCII-rendering page by pointing `FONTS.mono` / `--font-mono` at the self-hosted family.
4. Leave CJK and wide glyphs to system font fallback; the `Nch`-width forcing already guarantees column count.

Recommendations 1-4 shipped in PR #1059.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/978#issuecomment-6884746407
