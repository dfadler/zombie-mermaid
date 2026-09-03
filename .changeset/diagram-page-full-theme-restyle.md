---
'zombie-mermaid': patch
---

Diagrams SEO pages (`/diagrams/<type>.html`): picking a theme now restyles the whole page — background, header, breadcrumb, source panel, CTA buttons, footer — not just the diagram SVG. Previously the theme picker only updated the rendered diagram's CSS variables, leaving the surrounding page chrome locked to the default (zinc-light) colors, unlike the main demo gallery where a theme switch already restyles the entire page.
