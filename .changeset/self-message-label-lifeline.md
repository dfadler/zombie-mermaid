---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ASCII sequence diagrams where a self-message label (including multi-line `<br/>` labels) was drawn over the next participant's lifeline and erased it. The label now sits above the loop, as mermaid.js draws it, and the gap to the next participant widens only as far as the label needs. Closes #1387.
