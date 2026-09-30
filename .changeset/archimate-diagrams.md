---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': minor
---

Add ArchiMate diagram support (`archimate-layered`) in SVG and ASCII. `DiagramType` gains `'archimate'`, and `detectDiagramType` routes the `archimate-layered` header to it. Sources are parsed by a new `parseArchimate` in `@zombie-mermaid/mermaid-parser`, lowered to the flowchart model (`archimateToGraph`) with one titled band per layer, and rendered by the existing flowchart pipeline; elements use the ArchiMate layer colours and a `«Type»` line, and relationships are labelled with their type. Mermaid has no ArchiMate diagram, so the `archimate-layered` syntax is the DSL from lukilabs/beautiful-mermaid#34 (kristjanakkermann), kept unchanged. Prior art: #34 and #71 (Victor Palma, devx), both unmerged upstream. The implementation is fresh, written against the current registry design, but the parser and integration test fixtures in `archimate-upstream-parser.test.ts` and `archimate-upstream-integration.test.ts`, and the two `archimate-*.svg` examples, are ported from #71 (adapted to this design, with known gaps marked as skipped). Unlike upstream, a malformed statement is an error naming its line rather than being dropped. Relationship markers (diamonds, triangles) and layer bands in ASCII are not implemented; see `docs/decisions/archimate-lowering-1167.md`. Part of #1167.
