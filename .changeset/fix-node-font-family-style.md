---
'zombie-mermaid': patch
---

Fix per-node `font-family` from `style`/`classDef` (e.g. `style A font-family:monospace`) being parsed but silently dropped during SVG rendering. `renderNodeLabel()` only ever read `node.inlineStyle?.color` for the node's `<text>` element; `font-family` is now emitted as an inline `style="font-family: ...;"` attribute on that node's text — an inline `style` attribute is required (rather than a `font-family` presentation attribute, which is how `color`/`fill` are handled) because the global `font` render option is applied via a `text { font-family: ... }` rule in the embedded stylesheet, and presentation attributes always lose to stylesheet rules regardless of selector specificity. This makes the per-node override reliably win for that one node while every other node keeps falling back to the global font stack.
