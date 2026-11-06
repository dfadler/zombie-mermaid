---
'@zombie-mermaid/svg-renderer': patch
---

Output change: an empty class compartment is drawn 16 px tall (12 px in a class with no members at all) instead of an 8 px sliver, matching Mermaid 12.3.0's half-header compartments. Class boxes with an empty attributes or methods section are 16 px (or 8 px) taller.
