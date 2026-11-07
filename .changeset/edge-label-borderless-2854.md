---
'@zombie-mermaid/svg-renderer': patch
---

Output change: flowchart and state edge labels are drawn as Mermaid 12.3.0 draws them, a background exactly the size of the text with no border, no rounded corners and no padding, instead of an 8px-padded box with a 1px outline. Class diagram labels already matched.
