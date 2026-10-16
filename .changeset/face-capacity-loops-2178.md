---
'@zombie-mermaid/ascii-renderer': patch
'zombie-mermaid': patch
---

ASCII flowcharts: a node's side face now has a cell for each self-loop and each back-edge or skip beside its parallel-edge lanes, so lane ends no longer merge into one arrowhead or a `├`/`┤` tick in dense duplicate-edge graphs (#2178). Patch: lane placement in a dense graph is not a documented output contract (versioning policy section 1).
