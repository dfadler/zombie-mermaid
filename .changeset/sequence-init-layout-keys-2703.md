---
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Sequence `%%{init}%%` now honours `wrap`, `noteAlign`, `messageAlign` and, in SVG, `actorMargin`, `width`, `height`, `boxMargin`, `noteMargin`, `diagramMarginX/Y` and `bottomMarginAdj`, as mermaid 12.3.0 does. Font-size keys and `messageMargin` stay ignored because mermaid 12.3.0 ignores them too.
