---
---

No release: part 2 of #989's 3-PR split. `diagrams/<type>.html`'s "More
examples" section now shows every real sample for the type (up to 24, not
just the 3-14 curated ones), each card linking to its own new detail page
(#989's part 1) instead of the shared live editor. The type page's own
"Source -> render" hero panel also gains the same working SVG/ASCII output
toggle the new detail pages ship, reusing that same component rather than
a second implementation. Nothing here touches the published
`zombie-mermaid` package.
