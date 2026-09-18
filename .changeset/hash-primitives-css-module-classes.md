---
---

No release: turns on real content hashing for `demo/components/primitives.module.css`'s CSS Modules classes (`.card`/`.pill`/`.section-eyebrow`) now that every consumer imports the compiled classes map instead of hardcoding a selector string (zombie-mermaid#969). `.mono` moved to `tokens.tsx`'s `designBaseCss()` rather than being hashed — it's a page-wide utility class referenced by dozens of unrelated files and by raw SVG output outside this build, not a `primitives.tsx`-private implementation detail. Demo-site build tooling only — no published `@zombie-mermaid/*` package's runtime behavior changes.
