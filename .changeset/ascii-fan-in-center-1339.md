---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a plain node fed by several parents (`X --> A; Y --> A`) now sits centered between them, as in Mermaid, instead of under the first parent with the other edges running in from the side. It applies only when the edges are unlabeled and bundle into one trunk; a labeled fan-in, a parent that also feeds another node, and a node that fans out itself keep their previous placement (part of #1339). In `LR`/`RL` each parent leaves through its right (left) face and joins in the gap before the child, with no padding added to the neighbouring rows.
