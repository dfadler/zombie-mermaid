---
'zombie-mermaid': minor
---

Class diagrams now support notes: `note "text"` (free-floating) and `note for ClassName "text"` (attached to a class), with `\n` or `<br/>` for line breaks. The SVG follows Mermaid's own construction — the note is a node of its own, drawn as a dog-eared box, and an attached note is joined to its class by a dotted, arrowless link so the layout keeps them adjacent. In ASCII an attached note sits directly right of its class with rounded corners and a short dashed connector; a free note goes on the top row.
