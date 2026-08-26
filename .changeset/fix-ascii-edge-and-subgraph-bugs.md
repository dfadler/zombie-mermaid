---
'zombie-mermaid': patch
---

Fix three ASCII-renderer flowchart bugs (issue #65):

- `--o` and `--x` edges (e.g. `A --o B`) silently dropped the target node and the edge itself, with no error — the flowchart parser's arrow regex didn't recognize these tokens at all, so parsing broke out of the edge-line loop early. `--o`/`--x`/`o--`/`x--`/`o--o`/`x--x` are now recognized (`src/parser.ts`).
- An edge whose endpoint is a subgraph id (e.g. `ONE --> TWO` where `ONE`/`TWO` are subgraph ids, not nodes) produced two stray disconnected phantom boxes in the ASCII output instead of connecting the two subgraph frames. The ASCII converter now resolves a subgraph-id endpoint to a real member node at that subgraph's boundary, mirroring how the SVG/ELK path already treats the subgraph id as a valid compound-node edge endpoint (`src/ascii/converter.ts`).
- Inline `<i>`/`<b>`/`<em>`/`<strong>` tags in node/edge labels rendered literally in ASCII output instead of being stripped (`<br/>` was already handled). They're now stripped via the existing `stripFormattingTags` helper (`src/ascii/converter.ts`).
