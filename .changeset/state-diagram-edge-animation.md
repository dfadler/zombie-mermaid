---
'zombie-mermaid': minor
---

State diagrams now support the same edge-id and `e1@{ animate: true }` marching-ants animation syntax flowcharts already had (Mermaid v11.10.0+): `s1 e1@--> s2` declares an edge id, and a standalone `e1@{ animate: true }` line animates it via CSS `@keyframes`, guarded by `prefers-reduced-motion`. The renderer already handled this generically per-edge, so no renderer changes were needed — only `parseStateDiagram` gained the same parsing `parseFlowchart` already had, factored into a shared helper so the two parsers don't duplicate the metadata-line logic.
