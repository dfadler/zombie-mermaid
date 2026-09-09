---
---

No release: `ascii-renderer` and `mcp` became real workspace packages under
`packages/` (#767, finishing what #623 closed without doing; umbrella #620),
moving `src/ascii/**` to `packages/ascii-renderer/` and `src/mcp/**` to
`packages/mcp/` and rewriting internal imports accordingly, but nothing
consumer-facing moved with them. The published `zombie-mermaid` keeps the
same `exports` map and the same three entries, its bundled `.d.ts`/`.d.cts`
are byte-identical to the pre-move build, and every rendered SVG/ASCII byte
is unchanged — so there is nothing here to describe in a release note.
