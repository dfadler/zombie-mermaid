---
'zombie-mermaid': minor
---

SVG: new opt-in `dark: { bg, fg, ... }` render option adds a `@media (prefers-color-scheme: dark)` rule so one SVG adapts to the viewer's color scheme (#1877). Default output is unchanged; ignored with `resolveColors`.
