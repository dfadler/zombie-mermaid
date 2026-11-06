---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII cylinders (`[(x)]`, and `h-cyl`) draw one rim rule under the top edge and none above the bottom edge, like mermaid@12.3.0's single bottom arc, so a cylinder is as tall as a plain box (one row shorter than before). Refs #2164.
