---
'@zombie-mermaid/svg-renderer': patch
---

An edge that arrives straight on at a decision diamond now lands on its vertex, not on its slanted side. In the CI/CD sample, the arrow from "Deploy Staging" into "QA Approved?" used to end on the diamond's upper-left slope because ELK aims at an off-centre point on the bounding box; mermaid.js aims at the node's centre. Edges that share a face of a diamond, and edges leaving one, keep their spread.
