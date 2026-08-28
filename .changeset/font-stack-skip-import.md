---
'zombie-mermaid': patch
---

Fix a dead Google Fonts `@import` baked into every SVG when `font` is a font stack or a CSS generic family keyword.

`buildStyleBlock` only skipped the `@import` when `font` was a `var(...)` reference. Any other value — including a legitimate stack like `"ui-sans-serif, system-ui, sans-serif"` — got URL-encoded whole into a `family=` query param, producing an `@import` for a bogus font family name that always 404s.

The skip condition now also covers comma-separated font stacks and bare CSS generic family keywords (`sans-serif`, `serif`, `monospace`, `system-ui`, `ui-sans-serif`, `ui-serif`, `ui-monospace`, `ui-rounded`, `cursive`, `fantasy`, `math`, `emoji`, `fangsong`), none of which name a single concrete font that Google Fonts could ever host. The `var()` skip path and the `text { font-family: ... }` rendering are unchanged.
