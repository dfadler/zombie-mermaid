---
'@zombie-mermaid/ascii-renderer': patch
---

fix(ascii): draw a lone edge's label on its stroke, clear of the box borders, at a small `paddingY` (#2102). Output change at `paddingY` 3 or less only: in a TD/BT flowchart, a labelled edge between two stacked nodes now gets a gap of at least its label lines plus three rows (a plain stroke row above, a plain stroke row and the arrowhead below), so the existing on-stroke placement (#1408) applies and the label is centred on the stroke the way Mermaid draws it. Before, at `paddingY` 1 or 2 the label was drawn over the source box's bottom border (`└─push = build─┘`) and at 1 the stroke vanished; at 3 it sat beside the stroke. Default `paddingY` (5) output is unchanged for one- and two-line labels (a lone label of three or more lines gets a gap of its line count plus three rows, so 6 for three lines and 7 for four, up from 5, so it can sit on the stroke); LR/RL layouts, and every golden and snapshot suite pass unmodified. Compared against the inline label in Mermaid's own render of `A -->|push = build| B`; the SVG renderer is untouched.

Versioning: patch per docs/decisions/versioning-and-deprecation-policy-1568.md section 1, "Output changes": spacing and glyph placement are not documented output contracts, and `paddingY` is documented only as "vertical node spacing" with a default that is unchanged.
