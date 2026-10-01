---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

State diagrams without composite states now read top to bottom: the `[*]` start marker leads and the end marker trails, and a back-edge such as `Active --> Idle` no longer flips the main chain upside down. State edges also stop ending in a sideways arrowhead after layout compaction.
