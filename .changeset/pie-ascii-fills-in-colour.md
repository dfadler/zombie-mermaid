---
'@zombie-mermaid/ascii-renderer': patch
---

Pie charts in ASCII output: neighbouring bar segments now keep their different fills (`█▓▒░`, or `#=*+` with `useAscii`) in every colour mode, not only with `colorMode: 'none'`, with the colour painted on top. Before, colour modes drew every segment as a solid block, so two neighbours whose palette shades mapped to the same terminal colour (common in `ansi16`, for example two slices either side of a zero-value slice) merged into one run. Also, with more than 50 slices at 1% or more, a slice that ends up with no cell in the 50-cell bar is now shown like a slice under 1% (a `·` swatch and no percentage) instead of with a fill swatch and a percentage for a segment that isn't there.
