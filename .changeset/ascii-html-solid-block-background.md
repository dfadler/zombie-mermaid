---
'@zombie-mermaid/ascii-renderer': patch
---

`colorMode: 'html'` output no longer shows hairline seams inside solid bars (XY chart bars and other `█` fills) on displays scaled to a fractional size such as 125% or 150%. A run made only of full blocks now also gets a background of its own color, so the browser's anti-aliased glyph edges land on a solid fill instead of compositing to 75-81% brightness at every cell boundary. Other spans, half blocks, and the ANSI color modes are unchanged.
