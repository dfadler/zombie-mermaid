---
'zombie-mermaid': patch
---

Fix a potential crash rendering class diagram relationship cardinality labels when ELK.js produces no routed section for an edge (`rel.points` empty). Previously this would throw `Cannot read properties of undefined (reading 'x')`; now the cardinality label is simply skipped for that edge.
