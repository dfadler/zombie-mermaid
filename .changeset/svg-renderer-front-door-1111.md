---
'@zombie-mermaid/svg-renderer': minor
---

Add `renderMermaidSVG(text, options)` — a single "Mermaid text in, SVG out" entry point, for parity with `@zombie-mermaid/ascii-renderer`'s `renderMermaidASCII`. Previously this package only exported the lower-level per-diagram-type `layout*Sync()`/`render*Svg()` pairs; diagram-type detection and dispatch had to be assembled by hand or via the `zombie-mermaid` umbrella package. Also adds `renderMermaidSVGAsync` and `themeCssVariables`, and the deprecated `renderMermaidSync`/`renderMermaid` aliases.
