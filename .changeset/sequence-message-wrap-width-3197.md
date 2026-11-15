---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Sequence: with `wrap` on, a message wraps at the lifeline gap its own first wrap sizes (mermaid@12.3.0 wraps twice), not at `width + actorMargin`, so a long word splits into the same number of lines as mermaid (`Pneumonoultramicroscopicsilicovolcanoconiosis` at `width: 120` is two lines, not three).
