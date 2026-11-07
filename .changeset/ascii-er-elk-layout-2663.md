---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: with a layout provider registered (the root entry, the CLI and MCP do), an ASCII ER diagram takes its layers, in-layer order and alignment from ELK as mermaid 12.3.0 draws them: each layer is one row centred under the entities it connects to, a box's downward edges jog in nested order so they do not cross, and a label is kept off other edges' stems where the diagram has room (one extra row in a gap that carries labelled edges). `ORDER`/`PRODUCT` over `LINE_ITEM`/`SHIPMENT`/`REVIEW` now matches. Without a provider the placement is unchanged, except that a bypass edge routed down its own stem's column no longer draws a stray `┼` over that stem.
