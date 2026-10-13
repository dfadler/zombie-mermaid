---
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
---

New option `layout: 'simple'` on `renderMermaidSVG` and the flowchart layout functions: a small built-in layered layout (longest-path ranks, barycenter crossing reduction, least-squares coordinates) that lays flowcharts out without `elkjs`, so SVG flowcharts work in a size-sensitive browser bundle. It adds about 3.5 KB gzipped. It is opt-in and never an automatic fallback: **default output is unchanged** (unset and `layout: 'elk'` are byte-identical to before). Flowcharts only; state, class, ER and architecture diagrams ignore it and still need `elkjs`. It ignores `mergeEdges`, `layoutCache` and a subgraph's own `direction`. Placement agreement with mermaid 12.1.0 on the flowchart samples is within 1 point of ELK's (see `docs/decisions/simple-layout-1685.md`). `pnpm run layout:oracle -- --layout=simple` scores it. Refs [#1685](https://github.com/dfadler/zombie-mermaid/issues/1685).
