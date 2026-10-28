---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an ASCII asymmetric `>x]` now draws a notch on its left side like mermaid's (a blank left wall on the middle row and a `>` tip one cell in, in every direction including RL) instead of `▷` corners, and is one column wider so the label clears the tip (#2164).
