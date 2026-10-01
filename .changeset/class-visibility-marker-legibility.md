---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Make class-diagram visibility markers (`+`, `-`, `#`, `~`) legible in SVG output: they are drawn bold in the member-name colour instead of faint, so `~` no longer reads like `-` at 1x.
