---
'zombie-mermaid': patch
---

Fix ER diagram "zero or more" cardinality parsing for the left-side crow's-foot marker (`}o`, e.g. `TAG }o--|| PRODUCT`). The parser normalized cardinality strings by sorting their characters, which conflated the valid `}o` notation with the unrelated pair `{o`/`o{` and left `}o` unrecognized, silently dropping the relationship's cardinality. Left- and right-side notations are now matched explicitly instead of order-normalized. Also fixes the matching bug in the ASCII/Unicode renderer, where the "zero or one" crow's-foot marker (`o|`/`|o`) was drawn with the same character order on both sides of a relationship instead of mirroring to point away from its adjacent entity.
