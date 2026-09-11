---
'zombie-mermaid': patch
---

Fix ASCII sequence-diagram single-actor `Note over` boxes colliding with a neighboring actor's lifeline (#992). A note wider than its own actor's column now widens the lifeline gap on both sides (mirroring how `Note left of`/`Note right of` already do — #953 cases 3-5) instead of centering purely on the lifeline with no room reserved, so it no longer spills into whichever neighbor was closer. A multi-actor `Note over A,B` is unaffected — spanning both actors is its intended shape.
