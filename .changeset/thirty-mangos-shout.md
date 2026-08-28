---
"zombie-mermaid": patch
---

Fix ASCII display width for combining marks and composed emoji.

`displayWidth()` — the shared helper the ASCII/terminal renderer uses to size box borders — measured text per JS code point, which is wrong in two opposite directions. A decomposed combining mark (e.g. "café" as `e` + U+0301 COMBINING ACUTE ACCENT) counted as a full extra column even though a real terminal gives it zero, since it attaches to the preceding base character (#205). A composed multi-code-point emoji sequence — a ZWJ family emoji, a flag via regional indicators, a skin-tone modifier — counted once per code point even though a terminal renders it as a single glyph occupying at most two columns, so a five-code-point family emoji measured as 8 columns wide instead of 2 (#214).

Both are really the same bug: measuring by code point instead of by grapheme cluster, the Unicode notion of one user-perceived character. `displayWidth`, `charDisplayWidth`, and `toDisplayCells` now segment with `Intl.Segmenter` (`granularity: 'grapheme'`) and measure each cluster as a unit — 2 columns if any code point within it is "wide" (the existing CJK/fullwidth/emoji check), 1 otherwise, 0 for the degenerate case of a lone combining mark with no base character. `toDisplayCells` writes the whole cluster into one grid cell (plus a placeholder cell for wide clusters) so grid-cell count stays in sync with the column count the box-sizing math computes.

This fixes flowchart node labels, edge labels, subgraph titles, and both the single-box and multi-compartment (class/ER diagram) box-drawing paths, since all of them route through the same shared helper. The two call sites that intentionally mirror `displayWidth`'s per-cluster arithmetic to keep the demo site's HTML rendering of ASCII output in sync with the renderer's own box geometry (`fork-fixes.ts`, `demo/client.ts`) are updated to match.
