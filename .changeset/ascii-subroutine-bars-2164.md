---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an ASCII subroutine `[[x]]` now draws a second vertical bar inside each side (`┌┬──┬┐` / `││ x ││`, `++--++` / `|| x ||` in the ASCII charset) like mermaid's, instead of `╟ ╢` corners on a plain box, and its label is centred (#2164).
