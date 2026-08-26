---
'zombie-mermaid': patch
---

Fix an ASCII-renderer crash (part of the #100 type-safety audit) where `drawArrow` could throw `Cannot read properties of undefined (reading '0')` for a routed edge whose path collapses to a single grid point — e.g. closely-spaced/adjacent nodes whose preferred from/to connectors coincide (the same root cause as #153, in a different code path). The box-start connector and end arrowhead are now skipped for that degenerate case instead of indexing into an empty array.
