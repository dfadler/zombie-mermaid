---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': minor
---

Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, lowered to the flowchart model (`c4ToGraph`), and rendered by the existing flowchart pipeline, with persons, databases, queues, external systems and nested boundaries drawn in the standard C4 palette. Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and #71 (Victor Palma, devx), both unmerged upstream. The implementation is fresh, written against the current registry design, but the parser and integration test fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from #71 (adapted to this design, with known gaps marked as skipped). ArchiMate remains open under #1167. Part of #1167.
