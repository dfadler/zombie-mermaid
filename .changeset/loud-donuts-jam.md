---
'zombie-mermaid': minor
---

Add `RenderOptions.interactivity` (`'none' | 'static' | 'full'`, default `'static'`) as a render-target-scoped replacement for the xychart-only `interactive` boolean, which is now deprecated but still works unchanged. `'none'` strips flowchart edge animation (`e1@{ animate: true }`) for print/rasterized output; `'full'` additionally enables xychart hover tooltips. See `docs/decisions/no-script-interactivity.md` for the tier model behind this option, and the `interactivity` TSDoc in `src/types.ts` for exactly what each level gates today.
