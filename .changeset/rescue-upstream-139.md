---
'zombie-mermaid': patch
---

Fix edge-label text overflowing its padded background rect on wide labels. `getCharWidth` now uses exact per-glyph advance widths for printable ASCII, measured from the real Inter font (canvas `measureText`, headless Chrome, weight 400) and normalised so `ratio × fontSize × baseRatio` reproduces the measured pixel advance; accented Latin falls back to its base letter's advance. The coarse character-class buckets remain as the fallback for everything else. The buckets systematically underestimated Inter (spaces, `m`/`w`, digits, punctuation), and the error grew with label length, so wide edge labels ran past their 8px-padded background.

Note: because every SVG label is measured through this path, node and edge-label boxes across all diagram types become slightly wider to match Inter's real metrics — Playwright visual baselines need regenerating alongside this change.

Ports [lukilabs/beautiful-mermaid#139](https://github.com/lukilabs/beautiful-mermaid/pull/139) by [@OmShiv](https://github.com/OmShiv), open and unreviewed upstream since July 2026. The original commit is cherry-picked with its authorship intact; a follow-up commit only applies this repo's Prettier formatting.
