---
'zombie-mermaid': patch
---

Parser: a bare (bracket-less) flowchart node name containing a non-ASCII Unicode letter — `Lasaña --> Máquina`, `日本 --> 中国` — no longer truncates at the first non-ASCII character and silently drops the rest of that line (no node, no edge, no error). The regexes that capture a node identifier in `consumeNode()` — the bare-node regex plus the shape-bracketed, `@{...}`-expanded, and `:::`-class-shorthand id captures it shares — used a plain `\w` character class with no Unicode-letter support. They now also allow `\p{L}` (any Unicode letter), matching the pattern already used by the state-diagram transition regex. A quoted label (`A["Lasaña"]`) already worked and is unaffected. Fixes #328.
