---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

Ishikawa: the parser now rejects what mermaid@12.3.0's grammar rejects (a header followed only by whitespace, a bare header with no newline, a blank line directly before the effect), and `ishikawa.diagramPadding` from `%%{init}%%` or front matter moves the frame as in mermaid. `accTitle` / `accDescr` stay stripped on purpose and `look: handDrawn` is still not drawn; both are in `docs/known-differences.md`. New: `Ishikawa.diagramPadding` and `InitConfig.ishikawaPadding`.
