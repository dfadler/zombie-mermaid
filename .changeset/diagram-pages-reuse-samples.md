---
'zombie-mermaid': patch
---

The per-diagram-type SEO pages now genuinely reuse `samples-data.ts` for their Mermaid source instead of duplicating it as a hand-typed string literal that could silently drift from the real, already-vetted example (`demo/diagram-pages-data.ts`'s own header comment already claimed this, but wasn't actually wired up that way). Each page's source is now looked up by the referenced sample's title, and the build now fails loudly if that title is ever renamed or removed rather than leaving the page showing stale content.

Wiring this up surfaced two pre-existing, previously-uncaught issues, both fixed along the way:

- `demo/tsconfig.json`'s `rootDir` was scoped to `demo/` itself, which broke as soon as a file under `demo/` imported a repo-root file (`samples-data.ts`) — widened to the repo root; `noEmit` means this only affects rootDir's own consistency check, not what gets checked.
- `samples-data.ts`'s `Sample.options` type was missing `interactivity` (the renderer's own option, distinct from the existing `interactive` boolean), even though two samples already set it — this had never been caught because `samples-data.ts` wasn't reachable from either tsconfig's `include` until now.

No library API changes.
