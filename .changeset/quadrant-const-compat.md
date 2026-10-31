---
'@zombie-mermaid/svg-renderer': patch
---

Restore the `QUADRANT` fields that [#2463](https://github.com/dfadler/zombie-mermaid/pull/2463) removed: `width`, `height`, `axisLabelPadding`, `axisLabelFontSize`, `internalBorderWidth` and `externalBorderWidth`, with their 5.13.0 values. They are marked `@deprecated` in favour of `chartWidth`/`chartHeight`, `x/yAxisLabelPadding`, `x/yAxisLabelFontSize` and `quadrant{Internal,External}BorderStrokeWidth`, and will be removed in the next major.
