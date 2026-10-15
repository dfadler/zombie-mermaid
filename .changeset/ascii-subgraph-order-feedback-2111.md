---
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII flowcharts now order sibling subgraphs and orient feedback edges the way mermaid 12 and the SVG renderer do (#2111). Sibling subgraphs tied by an edge or a shared outside node keep declaration order (Nested Subgraphs lists US East before US West), and an edge that closes a cycle through a subgraph boundary is ranked as running the other way (CI/CD puts `Fix & Retry` beside `Build Image`). Titles of frames pushed back to their natural width are rechecked against entering edges. The SVG back-edge helpers moved to `@zombie-mermaid/core` so both renderers share them. Patch, not minor: a layout fix with no documented output contract involved (versioning policy, section 1, "Output changes").
