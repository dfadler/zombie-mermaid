---
---

No release: `core` and `svg-renderer` became real workspace packages under `packages/` (#625, umbrella #620), but nothing consumer-facing moved with them. The published `zombie-mermaid` keeps the same `exports` map and the same three entries, its bundled `.d.ts`/`.d.cts` are byte-identical to the pre-split build, and every rendered SVG/ASCII byte is unchanged — so there is nothing here to describe in a release note.
