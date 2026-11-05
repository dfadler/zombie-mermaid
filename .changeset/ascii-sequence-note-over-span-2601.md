---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an ASCII sequence `Note over A,B` now spans from A's lifeline to B's (one column past each), with its text centred, as Mermaid 12.3.0 does, instead of shrinking to its text. A note whose text is wider than the span widens the gaps between the two lifelines.
