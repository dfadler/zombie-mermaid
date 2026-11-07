---
'@zombie-mermaid/ascii-renderer': patch
'zombie-mermaid': patch
---

ASCII flowcharts laid out left to right (and right to left) now draw each edge of a side-by-side pair, duplicates and reciprocal edges alike, as a stroke of its own between the facing side faces in the order the ELK layout gives, labelled or not, instead of looping the later ones under the nodes. Edge hints are now matched to edges by their nodes, so a self-loop declared before other edges no longer shifts every later edge onto the wrong hint, a hinted edge that would run along the wall of a frame it has no end in keeps the grid's own route, and the fullest face of a pair is placed first so three ends on one face keep ELK's order.
