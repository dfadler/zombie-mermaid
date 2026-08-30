---
'zombie-mermaid': patch
---

Internal refactor: `escapeAttr` was defined identically in four SVG renderers (`renderer.ts`, `class/renderer.ts`, `sequence/renderer.ts`, `er/renderer.ts`). It's now a single shared export in `multiline-utils.ts`, imported by all four instead of redefined locally. No public API or rendered output changes.
