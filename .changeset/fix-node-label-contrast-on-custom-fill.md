---
'zombie-mermaid': patch
---

Fix unreadable flowchart node label text when a node has a custom `fill` (from `classDef`/`style`) but no explicit `color`. Text color previously always fell back to the theme foreground (`var(--_text)`), so a light pastel fill in dark mode (or a dark fill in light mode) could render white-on-light or black-on-dark text. When the fill is a concrete, resolvable hex color, the label now picks readable black or white text based on the fill's perceptual luminance; fills that aren't resolvable to a concrete color (CSS variable references, named CSS colors, malformed values) keep using the theme foreground unchanged.
