---
---

No release: `core` became a real workspace package under `packages/` (#625, umbrella #620; split from #654 into its own PR, with prep work in a preceding scaffold PR), but nothing consumer-facing moved with it. The published `zombie-mermaid` keeps the same `exports` map and the same three entries, its bundled `.d.ts`/`.d.cts` are byte-identical to the pre-split build, and every rendered SVG/ASCII byte is unchanged — so there is nothing here to describe in a release note.

The demo/site-generator files (`editor.ts`, `pages.ts`, etc.) still import `THEMES`/`isWideChar` via two temporary re-export shims at `src/theme.ts`/`src/text-metrics.ts`, deferred to a follow-up PR to keep this PR's file count reviewable.
