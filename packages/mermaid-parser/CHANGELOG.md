# @zombie-mermaid/mermaid-parser

## 2.2.1

### Patch Changes

- [#1088](https://github.com/dfadler/zombie-mermaid/pull/1088) [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043) Thanks [@dfadler](https://github.com/dfadler)! - Fix `xychart-beta` categorical `x-axis [...]` items keeping their
  literal quote characters in the rendered label (e.g. `x-axis ["Total
used", "CLI output / logs"]` rendered as `"Total used"` instead of
  `Total used`) ([#1087](https://github.com/dfadler/zombie-mermaid/issues/1087)). The axis-title capture group already stripped its
  surrounding quotes via the regex; each category item inside `[...]` was
  only split and trimmed with no equivalent unquoting. Both the ASCII and
  SVG renderers read `xAxis.categories` from this parser, so both were
  affected. (`y-axis` has no categorical form in this parser, so there's
  no equivalent branch there.)
- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66)]:
  - @zombie-mermaid/core@2.2.1
