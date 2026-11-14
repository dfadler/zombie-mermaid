---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Wardley maps (`wardley-beta`) render as SVG and as ASCII (#2820). The parser covers the whole mermaid@12.3.0 grammar (size, evolution stages, anchors, components with label offsets, build/buy/outsource/market, inertia, links with flow arrows and labels, evolve, pipelines, notes, annotations, accelerators and deaccelerators), and the SVG agrees with 12.3.0 to 0.01px on every gallery sample and 28 edge cases (`pnpm run wardley:oracle`). The ASCII output is this library's own: components on a visibility/evolution grid. `detectDiagramType` returns `'wardley'`, so `DIAGRAM_TYPES` and `DiagramType` gain a member and `Record<DiagramType, …>` maps need an entry. Output change: `wardley-beta` was rejected with "Invalid mermaid header".
