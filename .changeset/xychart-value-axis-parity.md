---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: SVG xychart value axis, flat data and x labels now match mermaid 12.2.0. The value axis keeps half a label of padding inside its line, so the smallest bar and the lowest line point stay visible; a single or all-equal value gets one tick instead of a tiny range; and every x-axis category is labelled, as mermaid does, instead of thinning dense categories. The ASCII renderer is unchanged.
