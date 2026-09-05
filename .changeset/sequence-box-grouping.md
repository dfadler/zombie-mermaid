---
'zombie-mermaid': minor
---

Sequence diagrams: Mermaid's `box <color?> <label?> ... end` participant grouping is now recognized. The header's leading word (or an `rgb()`/`hsl()` call) is parsed as a CSS colour when it matches a known named colour, hex, or function form — otherwise the whole header is the label, and an explicit `transparent` is treated as no colour with a label, matching Mermaid's own grammar. In SVG output the group renders as a themed background rectangle (colour blended via `color-mix()` so it reads correctly in both light and dark themes) with the label centred above the grouped participants; in ASCII output it renders as a labelled bracket around the header boxes and an unlabelled one around the footer boxes, since a full-height background would otherwise cut through messages crossing the group's boundary. Mermaid's own rules are enforced with Mermaid's own error text: a box cannot nest inside another box, and a participant can only belong to one box.
