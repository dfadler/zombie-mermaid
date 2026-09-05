---
'zombie-mermaid': patch
---

ASCII `erDiagram`: two unrelated relationships' vertical connector stems now keep at least one blank column of separation when their entity-center columns would otherwise land adjacent by coincidence. Previously, nothing in the rendered output distinguished two independent stems that happened to sit one column apart, so they could read as a single connector that inexplicably bends sideways partway down. Fixes #411.
