---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
---

Sequence diagrams now honour `%%{init: {"sequence": {"mirrorActors": false}}}%%` (no participant row under the lifelines) and `showSequenceNumbers: true` (numbers messages like `autonumber`), as mermaid does. The other sequence init options and `link`/`links` are still ignored and are listed in docs/known-differences.md (#2589).
