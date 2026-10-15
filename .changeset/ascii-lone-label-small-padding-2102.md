---
'@zombie-mermaid/ascii-renderer': patch
---

fix(ascii): keep a lone edge's label off the box border at a small `paddingY` (#2102). Output change at `paddingY` 3 or less only: in a TD/BT flowchart, a labelled edge between two stacked nodes now gets a gap of at least its label lines plus two rows (one arrowhead row, one plain stroke row). Before, at `paddingY` 1 or 2 the label was drawn over the source box's bottom border (`└─push = build─┘`) and at 1 the stroke vanished; now the gap grows and the label sits beside an intact stroke. A two-line label at `paddingY` 3 moves from a 3-row to a 4-row gap. Default `paddingY` (5) output, LR/RL layouts, every gallery sample and every other golden are unchanged (all hashed before and after in both charsets). Mermaid has no `paddingY`, so there is no mermaid.js behaviour to match; the SVG renderer is untouched.

Versioning: patch per docs/decisions/versioning-and-deprecation-policy-1568.md section 1, "Output changes": spacing and glyph placement are not documented output contracts, and `paddingY` is documented only as "vertical node spacing" with a default that is unchanged.
