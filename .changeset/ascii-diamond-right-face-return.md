---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in a left-to-right chart, a decision that has a return edge now spreads its right face as Mermaid 12.3.0 does: the first branch leaves the upper slant, `no` the right corner, and the return runs up the gutter and enters the lower slant in a horizontal run, uncrossed (it used to come up from under the diamond).
