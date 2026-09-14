---
'zombie-mermaid': patch
---

Fix SVG-rendered mono text (class-diagram method signatures, ER-diagram
attribute types) still loading JetBrains Mono from Google Fonts' CDN
(#1061, a follow-up from #1059's ASCII-side self-hosting fix). SVG output's
`.mono` rule now embeds a small, subsetted, self-hosted `@font-face`
(Basic Latin + Latin-1 Supplement, as a base64 `woff2` data URI) directly
in the SVG's own `<style>` block instead of importing from the CDN — on by
default for every consumer, works for a standalone SVG with no
surrounding host page, and removes the third-party network dependency
entirely rather than just tolerating its failure mode. `RenderOptions.font`
(the main body font's own Google Fonts import) is unaffected.
