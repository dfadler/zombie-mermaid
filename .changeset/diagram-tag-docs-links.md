---
---

No release: each of the 22 `diagrams/tag/<slug>.html` pages now links out
to the real Mermaid docs page (and, where one actually exists, the
anchor) that documents that construct -- e.g. `stereotype-annotation`
links to `classDiagram.html#annotations-on-classes`. Every anchor was
verified against the live page's real heading `id="..."` attributes, not
guessed at. Nothing here touches the published `zombie-mermaid` package.
