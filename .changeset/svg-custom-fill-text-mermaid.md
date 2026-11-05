---
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: text on a node with a custom `fill` now keeps the theme's text colour, as Mermaid 12.3.0 does, instead of being switched to black or white from the fill's brightness. A dark `style`/`classDef` fill therefore keeps dark text unless the diagram sets `color:` itself, which still wins. Applies to flowchart, state, class and ER nodes. `getReadableTextColor` stays exported from `@zombie-mermaid/core` (deprecated, unused) so the API does not break. To keep the old readability, add `color:` to the `style`/`classDef`.
