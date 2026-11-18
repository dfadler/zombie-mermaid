---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, SVG and ASCII: a state diagram node now wraps its label at 120px and is sized the way mermaid@12.3.0 sizes it (24px a line, 8px a side and 16px top and bottom, label measured at 16px). A long spaced label makes a taller node instead of a wider one, so concurrent regions with such a label pack in the same columns as mermaid@12.3.0. On 126 recorded cases (2 to 4 concurrent regions of 1 or 2 nodes, one wide spaced label at each position and length), the region cluster size matched in all 126, against 36 before. The ASCII renderer wraps a state box's label at the same words, so the regions form the same grid instead of one wide column. `@zombie-mermaid/core` now exports `wrapFlowchartLabel` and `FLOWCHART_WRAP_WIDTH` (moved from the SVG renderer).
