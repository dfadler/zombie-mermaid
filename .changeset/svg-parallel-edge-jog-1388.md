---
'@zombie-mermaid/svg-renderer': patch
---

SVG flowcharts: two parallel edges between differently sized, centered nodes (for example `Top <--> Bot` plus `Top <-.- Bot`) no longer kink by a fraction of a pixel just above the target node. ELK spread each edge across a node side relative to that node's own width, so the two ends landed at slightly different x values and the line stepped sideways, tilting the arrowhead off the edge's axis. Sub-1.5px jogs between two straight runs are now collapsed into one straight line.
