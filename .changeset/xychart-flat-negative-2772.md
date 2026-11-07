---
'@zombie-mermaid/svg-renderer': patch
---

Fix: an SVG XY chart bar series of one repeated negative value (`bar [-5, -5]`) now draws its bars from the mid-axis tick down to the axis start (left edge when horizontal), as Mermaid 12.3.0 does. They were zero-height and invisible. ASCII already matched Mermaid and is unchanged.
