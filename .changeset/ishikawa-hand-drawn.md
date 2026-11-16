---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

Ishikawa SVG: `look: handDrawn` (from `%%{init}%%` or front matter) now draws the spine, bones, solid arrowheads, label-box outlines and head outline with a dependency-free port of the rough.js generator, seeded by `handDrawnSeed`, matching mermaid@12.3.0's jitter. The hachure fill of the head and boxes is not drawn yet (`docs/known-differences.md`). New: `Ishikawa.handDrawn` and `InitConfig.handDrawnSeed`.
