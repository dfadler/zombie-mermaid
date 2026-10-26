---
'zombie-mermaid': patch
---

A flowchart whose feedback edge closes a cycle through a subgraph (`C --> A` back into a subgraph holding `A` and `B`) now puts `B` on the same side of `A`, `C` and `D` as mermaid 12.1.0 and 12.2.0 do, below them instead of above. "Flowchart: CJK Labels" scores 100% vertical agreement, up from 50%; no other sample's score moves (#1941).
