---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: the grid occupancy map now uses numeric cell keys instead of "x,y" strings, making flowchart edge routing about 15% faster on the sample set. Output is unchanged (#1424).
