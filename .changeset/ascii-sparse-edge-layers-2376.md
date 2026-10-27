---
'@zombie-mermaid/ascii-renderer': patch
---

Speed up ASCII rendering of dense labelled-edge diagrams: per-edge canvas layers now store only the cells they draw instead of full-height columns, cutting layer allocation about 280x at 320 labelled edges. Output is unchanged.
