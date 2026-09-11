---
---

No release: implements #1001, a "View all" single-scroll page
(`diagrams/all.html`) complementary to the per-type/per-sample/per-tag
pages, per docs/decisions/diagram-gallery-layout.md's revisited Direction
C. Lists every real sample across all six diagram types, grouped by type,
with a fixed-aspect-ratio thumbnail per card (the same #708 height fix
every other gallery grid on this site already uses). The diagrams hub
(`diagrams/index.html`) gets a new "View all diagrams" CTA linking into
it. Nothing here touches the published `zombie-mermaid` package.
