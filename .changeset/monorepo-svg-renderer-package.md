---
---

No release: `svg-renderer` became a real workspace package under `packages/` (#625, umbrella #620; second half of the split from #654), depending on `@zombie-mermaid/core` (extracted in the prior PR). Nothing consumer-facing moved with it. The published `zombie-mermaid` keeps the same `exports` map and the same three entries, its bundled `.d.ts`/`.d.cts` are byte-identical to the pre-split build, and every rendered SVG/ASCII byte is unchanged — so there is nothing here to describe in a release note.
