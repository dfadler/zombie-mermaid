---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

Output change: C4 SVG relationship labels no longer sit on shapes, boundary frames, boundary headings, other labels or other lines. A label is now slid along its line, set up to 28px to either side of it, or wrapped narrower (`PositionedC4Relationship` gains an optional `labelLines`) to find a clear spot, and is drawn on a background plate as flowchart edge labels are. A C4 person is now one outline, so the head no longer draws a second outline across the body (`<path class="c4-person-shape">` replaces the `<rect>` and `<circle>` pair). ASCII output is unchanged. Fixes [#1908](https://github.com/dfadler/zombie-mermaid/issues/1908).
