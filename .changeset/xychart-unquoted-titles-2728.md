---
'@zombie-mermaid/mermaid-parser': patch
---

Unquoted xychart titles are accepted as in Mermaid 12.3.0: `title Week 1 sales`, `y-axis Y Z 0 --> 5` and a one-word `x-axis Foo [a, b]` title read letters, digits and spaces, and drop the spaces (`Week1sales`, `YZ`). Output change: these sources used to be rejected (title) or ignored (axis titles).
