---
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
'zombie-mermaid': minor
---

Add an opt-in `embedFont: 'subset'` render option that inlines a base64 Inter subset (Basic Latin, weights 400-700, about 14.7 KB per SVG) instead of the Google Fonts `@import`, so the font also loads when the SVG is used as an `<img>`. Output is unchanged by default. The font data is a lazily loaded chunk, not part of the default bundle: `renderMermaidSVGAsync()` loads it, and the sync `renderMermaidSVG()` needs `await loadEmbeddedFont()` (new export) first. Takes effect only with `font: 'Inter'` (the default). (#1867)
