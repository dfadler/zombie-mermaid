---
'@zombie-mermaid/core': patch
'@zombie-mermaid/ascii-renderer': patch
---

Flowchart and state labels now decode Mermaid's entity codes (`#quot;`, `#lt;`, `#gt;`, `#35;`, `#x5B;`) instead of printing them literally, and ASCII output decodes `&quot;`/`&lt;`-style entities in labels as SVG already did. Decoding runs per label after parsing, ignores out-of-range code points, and never touches style lines. Idea from [lukilabs/beautiful-mermaid#158](https://github.com/lukilabs/beautiful-mermaid/pull/158) by thiccyoda.
