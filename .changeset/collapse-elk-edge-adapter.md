---
'zombie-mermaid': patch
---

Internal refactor: `src/layout-engine/from-elk.ts`, `src/class/layout.ts`, and `src/er/layout.ts` each independently walked an ELK edge's `section.startPoint → bendPoints → endPoint` into a `Point[]`, plus near-identical edge-label-position math. That logic is now shared via `extractEdgePoints`/`extractEdgeLabelPosition` in a new `src/layout-engine/elk-adapter-utils.ts`, imported by all three call sites. No public API or rendered output changes.
