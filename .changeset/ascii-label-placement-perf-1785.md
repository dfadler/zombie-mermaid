---
'@zombie-mermaid/ascii-renderer': patch
---

Speed up ASCII rendering of graphs with many labelled edges (about 2.5x at 160 labelled edges), with byte-identical output: copy-on-write canvas columns no longer use the slow `slice()` of a frozen array, label segments are looked up through a per-cell index instead of rescanned, and each label's competing placements are computed once per layout.
