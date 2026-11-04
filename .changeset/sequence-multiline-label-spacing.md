---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Sequence diagrams: a multi-line (`<br/>`) message label now keeps its last line just above the arrow and its first line where a one-line label sits (the arrow moves down instead of the text running onto it), and a multi-line frame label (`loop`, `alt`, ...) keeps its first line in the tab band with the extra lines below it and the first message pushed down to clear them, as in mermaid 12.3.0 (#2588).
