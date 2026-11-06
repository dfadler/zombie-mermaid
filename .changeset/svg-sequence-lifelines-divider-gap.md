---
'@zombie-mermaid/svg-renderer': patch
---

Output change: SVG sequence lifelines are solid and 0.5px wide, and the message below an `else`/`and` divider sits 26px further down, so the divider label clears the message label by 28px, as in Mermaid 12.3.0.
