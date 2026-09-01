---
'zombie-mermaid': patch
---

Demo site: reword the hero render-progress line so it reads as intentional status copy ("Rendering samples… X of Y done." / "Rendered all N sample outputs...") instead of a leftover debug counter, and give it the same `scroll-margin-top` treatment `.sample` sections already get so it clears the sticky theme bar instead of rendering underneath it on mobile. No library API changes.
