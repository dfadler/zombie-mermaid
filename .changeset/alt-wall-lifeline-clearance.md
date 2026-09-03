---
'zombie-mermaid': patch
---

ASCII sequence diagrams: fix a block wall (`loop`/`alt`/`opt`/`par`/etc.) landing exactly on a lifeline column it doesn't otherwise touch, subsuming that lifeline for the block's whole vertical span. All block types share one wall-extent calculation, padded from the lifelines the block's own messages reach — a fixed margin could coincidentally place a wall on a different, untouched lifeline's column. The wall now nudges clear of any lifeline it would otherwise land on.
