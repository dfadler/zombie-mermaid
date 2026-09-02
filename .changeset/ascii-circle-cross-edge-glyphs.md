---
'zombie-mermaid': patch
---

ASCII backend: flowchart `--o`/`--x` (and `o--`/`x--`) edges now draw a distinct circle/cross terminator (`○`/`✕`, or `o`/`x` in ASCII mode) instead of a plain arrowhead, and sequence-diagram `-x`/`--x` "lost message" arrows now draw a distinct cross glyph instead of the same filled arrowhead as `->>`/`-->>`. Parsing already distinguished these correctly (see #65) — only the rendered glyph was missing the distinction. A fan-in bundle (several sources converging on one shared target) keeps the circle/cross glyph only when every bundled edge agrees on the same marker, falling back to the plain arrowhead otherwise. SVG output is unchanged — see #330.
