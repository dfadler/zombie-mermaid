---
'zombie-mermaid': patch
---

ASCII ER diagram renderer: horizontal crow's-foot cardinality markers (`│`/`○│`/`│○`/etc.) are inset one cell from the entity border again, instead of sitting flush against it. This reverts the horizontal side of #390's flush-marker change back to pre-#390 behavior, per the reviewer's own vetted proposal on issue #351's review comment. It's a readability-preference revert, not a defect fix — issue #413 explicitly reclassified the flush-vs-inset question as a subjective style choice after confirming both render legibly in a real terminal. Vertical markers (already flush against `─`, with no border-glyph collision) are unaffected.
