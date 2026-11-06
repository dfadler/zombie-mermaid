---
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
---

Sequence diagrams honour `%%{init: {"sequence": {"hideUnusedParticipants": true}}}%%` like mermaid 12.3.0: participants that no message, `activate` or note names are dropped (#2589).
