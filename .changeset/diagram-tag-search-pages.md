---
---

No release: implements the single-tag portion of #991 /
docs/decisions/diagram-tag-search.md. A real construct taxonomy
(`demo/diagram-tags.ts`, 22 tags, detected mechanically from each real
sample's Mermaid source rather than hand-assigned) generates one static
page per tag that actually has at least one match:
`diagrams/tag/<slug>.html`, listing every matching sample across every
diagram type. Every specific-diagram detail page (#989) now shows real,
working tag pills linking into these pages instead of no tags at all.
Nothing here touches the published `zombie-mermaid` package.
