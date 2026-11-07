---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: the ASCII diamond, circle and double circle grow taller with their label, as Mermaid 12.3.0 draws them square at every label size. A node is about half as many rows as it has columns (rounded to an odd count, never fewer than before), so a decision node with a longer label gains rows while short ones keep their 5.
