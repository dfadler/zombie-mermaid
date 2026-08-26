---
'zombie-mermaid': patch
---

Fix `RenderOptions.font` breaking when passed a CSS `var(...)` reference (e.g. `{ font: 'var(--font-family-body)' }`), which previously produced a broken Google Fonts `@import` and a quoted, inert `font-family` value. A validated `var()` reference (including one with a quoted fallback argument, e.g. `var(--font, 'Fallback Font')`) now skips the Google Fonts import and is emitted unquoted. Also sanitizes `font` before it's embedded in the generated `<style>` block, since it's user-supplied input.
