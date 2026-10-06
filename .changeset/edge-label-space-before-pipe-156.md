---
'@zombie-mermaid/mermaid-parser': patch
---

Flowchart parser: allow a space before the edge label pipe, so `A --> |deploy| B` keeps its target and label instead of dropping them. Rescued from upstream lukilabs/beautiful-mermaid#156 by NahumLitvin.
