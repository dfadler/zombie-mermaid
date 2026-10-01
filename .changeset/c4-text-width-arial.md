---
'@zombie-mermaid/svg-renderer': patch
---

C4 SVG shapes now size their text the way Mermaid does: widths are summed from Arial advances (regular and bold) instead of a scaled Inter estimate, and a name or description wraps at the shape width less its padding (176px) judged at regular weight, so a bold name can run past it. A person with a three-line description is 216px wide as in Mermaid (it was 222px), and a very long label no longer makes the whole diagram about 10px wider.
