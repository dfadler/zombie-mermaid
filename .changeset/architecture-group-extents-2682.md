---
'@zombie-mermaid/svg-renderer': patch
---

Output change: architecture SVG groups are sized as in Mermaid 12.3.0 (a group around one service is 165 x 182, each outer nesting level adds 83, a group around a junction pads a full tile). Two neighbouring services now sit 200 apart across one group border, +41.5 for each further border, instead of +40 per border.
