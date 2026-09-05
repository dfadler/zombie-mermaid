---
'zombie-mermaid': minor
---

ASCII output can now carry `click` links into the terminal. A new opt-in `hyperlinks: true` option on `renderMermaidASCII` (and `--hyperlinks` on `zombie-mermaid render --ascii`) wraps the label of every node whose `click` directive declared an http/https/mailto/relative href in an OSC 8 terminal-hyperlink escape pair, which terminals that support OSC 8 (iTerm2, WezTerm, kitty, Windows Terminal, VTE-based terminals) render as a clickable link. The sequences are zero-width and never affect layout; stripping them yields exactly the non-hyperlinked output. `click ... call fn()` bindings emit nothing, unsafe schemes (`javascript:`, `data:`) are dropped by the same filter the SVG renderer uses, and the option is ignored in `colorMode: 'html'`. Off by default: not every terminal or pager handles OSC 8 gracefully, so the caller — not the library — decides. Flowchart and class diagrams are covered (the diagram types whose parsers record `click`). See #216.
