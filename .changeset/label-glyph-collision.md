---
'zombie-mermaid': patch
---

ASCII rendering: edge and box labels no longer get silently truncated or corrupted where they collide with a connector line or box border. Three distinct root causes, all in the same family (a label not defending its own space against something drawn nearby): a subgraph title's internal space character let an underlying connector line show through (canvas merge treating space as transparent); a later-drawn relationship's connector line landing on top of an earlier relationship's already-drawn class-diagram label (single-pass draw-then-label-inline ordering); and same-row class-diagram labels overwriting each other order-dependently when spaced closer together than they're wide. Labels that are too wide for their available space now truncate consistently with a `…` ellipsis across all six of a diagram's relationship labels, instead of an arbitrary subset being silently destroyed.
