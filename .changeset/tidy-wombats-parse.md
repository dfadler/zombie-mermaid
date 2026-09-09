---
'zombie-mermaid': patch
---

Fix flowchart parsing so a vertex-chain statement split across lines — with the link operator (e.g. `==>`) leading the continuation line instead of trailing the previous one — no longer silently drops the continuation node(s)/edge(s) or falls back to a node's bare id as its label. Matches the exact repro from mermaid-js/mermaid#6049, which upstream Mermaid already renders correctly.
