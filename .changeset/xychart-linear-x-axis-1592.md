---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG xychart charts with a numeric x-axis range (`x-axis 0 --> 100`) now use a linear axis, as mermaid 12.2.0 does: a label at every tick of the range (every 10 for `0 --> 100`, every 0.5 for `2020 --> 2024`), and bars and line points placed by value across the range instead of on evenly spaced category slots. Horizontal charts run the range from the bottom up, as mermaid does. `pnpm run xychart:oracle` now scores ten numeric-range cases whose point counts are not tick-aligned. ASCII output is unchanged ([#1592](https://github.com/dfadler/zombie-mermaid/issues/1592)).
