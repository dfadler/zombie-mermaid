---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ASCII flowcharts where two labeled edges reaching the same side of a node from opposite directions (such as the two "No" edges into "Fix & Retry" in the CI/CD sample) merged into one line with a single arrowhead. Each now gets its own column and arrowhead. Closes #1399.
