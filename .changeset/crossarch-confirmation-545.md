---
'zombie-mermaid': patch
---

Close out #545 (cross-arch Docker visual-regression parity spike) with a
flag-matched, same-commit confirmation: three full-suite runs on native arm64
with `CI=true` (843/843 passing in the final tally, baselines unchanged) plus
a real x86-CI comparison on the identical commit. Architecture is ruled out
as a driver of screenshot divergence for both the ASCII and SVG halves of the
suite. No source changes; docs only (research doc + decision amendment).
