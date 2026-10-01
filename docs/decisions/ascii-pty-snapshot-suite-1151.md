# Real-PTY pixel-snapshot CI suite for ASCII rendering: not now

## Context

[#1141](https://github.com/dfadler/zombie-mermaid/issues/1141) asked how to
automate real-terminal verification of ASCII output. Its confirmed bug was
fixed in [#1146](https://github.com/dfadler/zombie-mermaid/pull/1146) and
Option A (a Vitest check that `renderMermaidASCII` and the `ascii-html.ts`
mockup produce identical character grids) shipped in
[#1147](https://github.com/dfadler/zombie-mermaid/pull/1147).
[#1151](https://github.com/dfadler/zombie-mermaid/issues/1151) asks whether
to also add Option B: a CI job that records each sample through a real PTY
(`ascii-terminal-capture.sh`, `ASCII_AGG_RUNTIME=docker`) and diffs the PNG
against committed goldens.

## Decision

Recommendation: do not add Option B now. Owner confirmation is pending on
#1151.

- **Benefit is narrow.** After #1147, what B adds is real font shaping and
  rasterization artifacts (e.g. a notched box-drawing glyph from a missing
  font). That class has produced no repeat incidents, and the Docker/agg image
  pins the font, so it would mostly re-test agg, not this repo.
- **Cost is recurring.** About 90 new goldens on top of the ~560 PNGs the
  Playwright visual suite already carries, an asciinema + agg + Docker CI
  dependency, a PTY recording plus rasterization per sample, and a regenerate
  and review step whenever ASCII output legitimately changes (already true for
  the mockup side).
- **Revisit trigger.** A second regression that passes #1147 but is visibly
  wrong in a real terminal.

If the owner wants it anyway, scope it small: a curated subset (roughly
10 to 15 samples covering box drawing, wide chars, and color), path-filtered
to `packages/ascii-renderer/**` and `ascii-html.ts`, `workflow_dispatch` or
non-blocking first, with a generous pixel tolerance.

## Consequences

`ascii-terminal-capture.sh` and the `verify-ascii-terminal` skill remain the
manual before/after check for ASCII PRs; CI enforcement stays at Option A.
