---
'@zombie-mermaid/svg-renderer': patch
---

Output change: SVG sequence diagrams leave mermaid@12.3.0's room (33px label to label) between a block header label and its first message, 45px between a nested block's outer header and the inner tab, and draw each lifeline as one straight line through message and block labels instead of cutting it around them. Closes #2706.
