---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an architecture `junction` is no longer drawn as a 5 x 5 box of `●` marks in ASCII. Like Mermaid 12.3.0 it has no shape: the cell where its edges meet is the line join they need (`┬`, `├`, `┼`, `+` in ASCII mode), and a junction with no edges draws nothing.
