---
'zombie-mermaid': patch
---

ASCII: label placement is now computed once per edge per draw instead of once per draw call, cutting a 160-labelled-edge render from about 3.5 s to about 1.2 s with byte-identical output (#1785).
