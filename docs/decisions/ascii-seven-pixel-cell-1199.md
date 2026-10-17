# The browser ASCII mockup uses an exact, odd 7px cell

Status: implemented

## Context

The HTML mockup of a terminal (`.ascii-output` in `demo/styles.css`) drew line
and block glyphs with visible seams and blurry vertical strokes. The mockup is
not what a terminal prints (see
[`docs/visual-regression.md`](../visual-regression.md)); this concerns only how
faithfully the browser approximation draws the cells.

## Decision

Pin the cell to exactly 7px wide with a 15px row: `font-size: 11.67px`,
`letter-spacing: -0.002px`, `line-height: 15px`. Introduced in commit `277f60c6`
(2026-09-30) and merged with
[#1199](https://github.com/dfadler/zombie-mermaid/pull/1199) (2026-10-01). The
reasoning, with measurements, is in
[`docs/visual-regression.md`](../visual-regression.md) (the seams and crispness
paragraphs); in short:

- **Exact:** JetBrains Mono's advance is 0.6em and Chromium snaps font sizes to
  0.01px, so 11.67px gives 7.002px; a fractional pitch puts glyph edges
  mid-pixel and dims a pixel column at every seam. The `-0.002px` stops drift
  across wide diagrams.
- **Odd:** a vertical stroke is centred in its cell. At 7px it lands in one
  pixel column (18/220/18); at 8px it straddles two (146/146), a blurry,
  beaded line.
- **15px rows:** the only integer height passing both probes (seams fail at
  16px, legibility at 14px; message of `277f60c6` and the CSS comment).

Rejected: an 8px cell (even), and a 9px cell, which is odd but measured
blurrier on the crispness probe (median stroke width 1.45 to 1.48 against
1.14 to 1.16 for 7px).

## Consequences

- Changing the font, size or letter-spacing of `.ascii-output` must keep the
  cell integral; the `ascii-seams`, `ascii-crispness` and `ascii-legibility`
  visual tests enforce it.
- It affects only the browser mockup, never `renderMermaidASCII` output. A PR
  screenshot of an ASCII change still comes from a real terminal (`CLAUDE.md`).
- The probe thresholds were calibrated on macOS at 1x and 2x only
  (`docs/visual-regression.md`).
