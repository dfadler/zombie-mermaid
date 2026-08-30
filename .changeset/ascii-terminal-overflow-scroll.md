---
'zombie-mermaid': patch
---

Demo site: the ASCII terminal panel on a sample card now scrolls horizontally instead of spilling wide diagrams past the card's right edge. The panel's active-view layout intentionally drops vertical overflow clipping so the card grows to fit tall diagrams, but it was dropping horizontal overflow too — a diagram wider than the card had no scrollbar and was simply cut off by the page edge. No library API changes.
