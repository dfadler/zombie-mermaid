---
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

Flowchart layout: six or more labelled edges from one node to the same target no longer drop that target a layer below its siblings. Output change: SVG layout of flowcharts with a labelled parallel run (three or more labelled edges between one pair) can shift; the two targets now sit level as in mermaid 12.1.0 and 12.2.0 (#2154). Patch: a pure layout fix, and layout is not a documented output contract (versioning policy section 1).
