---
'zombie-mermaid': minor
'@zombie-mermaid/ascii-renderer': minor
---

ASCII: a stadium `([x])` is now drawn as a pill (rounded top and bottom, `(` `)` sides) and a hexagon `{{x}}` with points at the left and right middle (`╱ ╲ < >`, or `/ \ < >` in the ASCII charset), instead of boxes with swapped corner glyphs. A hexagon keeps a rectangle's width for a one-line label and grows wider only for a taller one. An edge leaving the point now starts beside it instead of cutting it off (#2164).
