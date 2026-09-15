---
'@zombie-mermaid/mermaid-parser': patch
---

Fix `xychart-beta` categorical `x-axis [...]` items keeping their
literal quote characters in the rendered label (e.g. `x-axis ["Total
used", "CLI output / logs"]` rendered as `"Total used"` instead of
`Total used`) (#1087). The axis-title capture group already stripped its
surrounding quotes via the regex; each category item inside `[...]` was
only split and trimmed with no equivalent unquoting. Both the ASCII and
SVG renderers read `xAxis.categories` from this parser, so both were
affected. (`y-axis` has no categorical form in this parser, so there's
no equivalent branch there.)
