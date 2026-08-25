---
'zombie-mermaid': patch
---

Fix a potential out-of-memory crash in the ASCII/Unicode renderer's A\* pathfinder. On dense graphs where an edge's destination is unreachable through free grid cells, the pathfinder's open-set could grow without bound (`RangeError: Map maximum size exceeded`) instead of terminating. The search now gives up and returns `null` (routing falls back gracefully) after 50,000 iterations.
