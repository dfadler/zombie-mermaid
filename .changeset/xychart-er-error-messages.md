---
'zombie-mermaid': patch
---

Improve parse-error quality for xychart-beta and ER diagrams. The
xychart-beta parser now throws an actionable error naming the bad value
and its position when a `bar`/`line` series contains a non-numeric entry
(previously silently coerced to `NaN`), and when an `x-axis`/`y-axis`/
`bar`/`line`/`title` directive's syntax is malformed (previously silently
dropped, e.g. an unclosed bracket). The ER diagram parser now throws when
a relationship line has an invalid cardinality token or is missing its
`: label` (previously silently dropped the entire line, including both
entities), instead of accepting malformed input silently. Refs #541.
