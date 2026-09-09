---
'zombie-mermaid': patch
---

Register `flowchart` (and the `state` pipeline it shares) in the SVG (`src/diagram-registry.ts`) and ASCII (`src/ascii/registry.ts`) diagram-type registries — the last diagram type still handled by a fallback switch instead of a registry entry (#533, #745). Extracted `renderFlowchartAscii` as its own ASCII entry point, matching every other diagram type's shape. Pure internal refactor — zero output change, confirmed byte-identical across SVG and ASCII render options.
