---
---

No release: the per-diagram-type pages' "More examples" gallery thumbnails
(#714/#715) now re-theme along with the page's primary diagram when a
visitor picks a theme. They're rendered at build time with the same
`renderMermaidSVG`/`--bg`/`--fg`-driven markup, just at the page's default
theme, but `demo/diagram-page-client.ts`'s `applyThemeToDiagram` only ever
targeted `.diagram-frame svg` — so the thumbnails stayed stuck on that
default regardless of the selected theme. Extends the selector to
`.diagram-frame svg, .gallery-thumb svg`. Demo-site UI only; nothing here
touches the published `zombie-mermaid` package.
