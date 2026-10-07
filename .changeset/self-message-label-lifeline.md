---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ASCII sequence diagrams where a self-message label (including multi-line `<br/>` labels) was drawn over the next participant's lifeline and erased it. The gap to the next participant now widens to fit the loop and label. Closes #1387.
