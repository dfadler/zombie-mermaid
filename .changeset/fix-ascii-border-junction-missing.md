---
'zombie-mermaid': patch
---

Fix ASCII-charset rendering (`{ useAscii: true }`) never drawing a junction character where an edge exits a node's border — the border stayed a plain run of dashes (e.g. `+--------------+`) at the exact column a connector dropped or branched from it, while Unicode mode correctly drew a T-junction there (e.g. `└───────┬──────┘`). Both `drawBoxStart` and the fan-in bundle's box-start connector now write the ASCII junction character (`+`) instead of skipping junction placement entirely in ASCII mode.
