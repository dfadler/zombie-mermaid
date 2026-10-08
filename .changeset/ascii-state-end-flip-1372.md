---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: the double-line state-end box (`[*]` as a target) kept wrong corners under `BT` and `RL` (`╗═══╔` instead of `╔═══╗` for `RL`, top and bottom swapped for `BT`). The flips now remap `╔╗╚╝` too (refs #1372).
