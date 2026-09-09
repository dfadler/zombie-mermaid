---
---

No release: `mermaid-parser` became a real workspace package under `packages/`
(#624, umbrella #620), splitting the parser half (`parser.ts`/`types.ts`,
plus `class/format.ts`, `sequence/box-color.ts`,
`sequence/activation-check.ts`, `xychart/colors.ts`) of `src/class/`,
`src/er/`, `src/sequence/`, `src/xychart/` out into it, and moving the
renderer half (`layout.ts`/`renderer.ts`) of those same four directories
into the existing `svg-renderer` package — but nothing consumer-facing
moved with them. The published `zombie-mermaid` keeps the same `exports`
map and the same three entries, its bundled `.d.ts`/`.d.cts` are
byte-identical to the pre-split build, and every rendered SVG/ASCII byte is
unchanged — so there is nothing here to describe in a release note.
