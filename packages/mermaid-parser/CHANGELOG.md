# @zombie-mermaid/mermaid-parser

## 4.2.1

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@4.2.1

## 4.2.0

### Minor Changes

- [#1371](https://github.com/dfadler/zombie-mermaid/pull/1371) [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 1: parsing and detection. `DiagramType` gains `'pie'`, and `detectDiagramType` routes a `pie` header to it (case-sensitively, as Mermaid does). `@zombie-mermaid/mermaid-parser` adds `parsePieChart` with the `PieChart`/`PieSlice` types (title, accTitle, accDescr, showData, slices in source order). The parser accepts and rejects the same input as Mermaid's own pie grammar: labels must be quoted, negative values are errors, zero is allowed, a repeated label keeps its first value, `showData` is only valid on the header line, and a bare `pie` with no slices is valid. `renderMermaidSVG` and `renderMermaidASCII` route a pie chart to the pie parser (so syntax errors are reported with their line) instead of misrouting it to the flowchart parser; the rendering itself is covered by the separate pie SVG and ASCII renderer changesets. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with strictness ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.

- [#1376](https://github.com/dfadler/zombie-mermaid/pull/1376) [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 2: SVG rendering. `renderMermaidSVG` now draws `pie` charts with Mermaid's own layout: slices in source order, clockwise from 12 o'clock, each labelled inside with its whole-number percentage; slices under 1% of the total left out of the pie but kept in the legend; a legend on the right listing every slice (`label [value]` with `showData`); the title above the pie; and an empty circle for a chart with no slices. Colours follow the theme: the accent, then the XY chart series shades, repeating after 12, at Mermaid's 0.7 slice opacity with a 2px outline. Mermaid's `accTitle` becomes the SVG's accessible name (unless the `title` option is given) and `accDescr` its description. `@zombie-mermaid/mermaid-parser` adds the `PositionedPieChart`/`PositionedPieSlice`/`PositionedPieLegendItem` types, `@zombie-mermaid/svg-renderer` exports `layoutPieChart` and `renderPieSvg`, and `@zombie-mermaid/core`'s `svgOpenTag` takes an optional `description` that emits a `<desc>` referenced by `aria-describedby`. The flowchart parser's unknown-header error now lists `pie`. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy and [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.

### Patch Changes

- [#1367](https://github.com/dfadler/zombie-mermaid/pull/1367) [`700b97b`](https://github.com/dfadler/zombie-mermaid/commit/700b97bcbf5adeec39a438e7257fff71deff6fb6) Thanks [@dfadler](https://github.com/dfadler)! - Flowchart parser: allow a space before the edge label pipe, so `A --> |deploy| B` keeps its target and label instead of dropping them. Rescued from upstream lukilabs/beautiful-mermaid#156 by NahumLitvin.
- Updated dependencies [[`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2), [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7), [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64)]:
  - @zombie-mermaid/core@4.2.0

## 4.1.0

### Patch Changes

- Updated dependencies [[`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277), [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36)]:
  - @zombie-mermaid/core@4.1.0

## 4.0.0

### Patch Changes

- [#1274](https://github.com/dfadler/zombie-mermaid/pull/1274) [`20db743`](https://github.com/dfadler/zombie-mermaid/commit/20db743be4508a59d57bfe81a97fb916910b2a54) Thanks [@dfadler](https://github.com/dfadler)! - Class diagram attributes now render as written, matching Mermaid. `-data Map` used to be flipped to `- Map: data`; `-data Map`, `+String name` and `+name: Type` now all keep their source order (methods still render as `name(): type`).

- [#1299](https://github.com/dfadler/zombie-mermaid/pull/1299) [`c7d9704`](https://github.com/dfadler/zombie-mermaid/commit/c7d9704c9cbc9f39d3408a0d4cac124e2e1852dc) Thanks [@dfadler](https://github.com/dfadler)! - Class diagram SVG now draws `namespace Name { ... }` blocks as a titled frame around their member classes, as Mermaid does. Previously the blocks were parsed but never drawn. `PositionedClassDiagram` gains a `namespaces` array carrying each frame's geometry.

- [#1276](https://github.com/dfadler/zombie-mermaid/pull/1276) [`89e915f`](https://github.com/dfadler/zombie-mermaid/commit/89e915ff838a140dbac4bc6452e4460cf766693c) Thanks [@dfadler](https://github.com/dfadler)! - ER relationship labels are now dark enough to pass WCAG AA (4.5:1) on the default theme, and the third series in an XY chart is a distinct sky blue instead of a second light blue close to the first series.

- [#1258](https://github.com/dfadler/zombie-mermaid/pull/1258) [`7e4db32`](https://github.com/dfadler/zombie-mermaid/commit/7e4db3206ab61740b54f427003ab3fb248001d66) Thanks [@dfadler](https://github.com/dfadler)! - Sequence diagrams: a nested activation (for example `S->>+S` while `S` is already active) now draws an outer bar and a nested bar offset half a bar to the right, as official Mermaid does. Before, the nested bar was offset only 4px and painted underneath its parent, so it showed as a sliver and read as a single bar. The positioned `Activation` gains a `depth` field. Closes [#1241](https://github.com/dfadler/zombie-mermaid/issues/1241).
- Updated dependencies []:
  - @zombie-mermaid/core@4.0.0

## 3.2.0

### Minor Changes

- [#1195](https://github.com/dfadler/zombie-mermaid/pull/1195) [`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9) Thanks [@dfadler](https://github.com/dfadler)! - Add `architecture-beta` diagrams (Mermaid's native syntax: `group`, `service`, `junction`, port-sided edges, `{group}` edges). They are lowered to the flowchart model and render in SVG and ASCII; ports steer flow direction rather than an exact grid, and icons are not drawn. `DIAGRAM_TYPES` gains `'architecture'`.

- [#1192](https://github.com/dfadler/zombie-mermaid/pull/1192) [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1) Thanks [@dfadler](https://github.com/dfadler)! - Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII with dedicated renderers. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, which records `Rel_U/D/L/R` placement hints. The SVG renderer lays out with ELK (nested boundaries, relationships to boundaries) and draws a person glyph, cylinders, queues, the C4 palette, boundary frames, a title, and relationship labels with a separate `[technology]` line. The ASCII renderer has its own row layout, boxes, boundary frames, and grid router. `Rel_D`/`Rel_U` steer layering; `Rel_R`/`Rel_L` place elements side by side (exact in ASCII, a best-effort nudge in SVG). Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (devx), both unmerged upstream; nothing was copied from either renderer; the parser and integration fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (adapted, with known gaps marked as skipped). ArchiMate remains open under [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167).

### Patch Changes

- [#1204](https://github.com/dfadler/zombie-mermaid/pull/1204) [`54432b6`](https://github.com/dfadler/zombie-mermaid/commit/54432b6206c1af5d2e2d4fdd447256d9bbbcc85b) Thanks [@dfadler](https://github.com/dfadler)! - C4 SVG output now follows Mermaid's own C4 renderer instead of a layered graph layout. Shapes are placed in rows in declaration order (four to a row, boundaries two to a row), sized as Mermaid sizes them (216px wide, wider when the text is), and drawn the way Mermaid draws them: rounded boxes, a pill with a round head for a person, cylinders and pipes, dashed boundary frames with a centred title and type, a straight first relationship with curved ones after it, and plain-text labels. As in Mermaid, `Rel_U/D/L/R` and `RenderOptions.direction` do not move anything in the SVG. ASCII output is unchanged.
- Updated dependencies [[`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9), [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1), [`f01ed87`](https://github.com/dfadler/zombie-mermaid/commit/f01ed8761b156c33d88a3b9fb9bc21c805675085)]:
  - @zombie-mermaid/core@3.2.0

## 3.1.0

### Patch Changes

- Updated dependencies [[`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e), [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34)]:
  - @zombie-mermaid/core@3.1.0

## 3.0.0

### Major Changes

- [#1125](https://github.com/dfadler/zombie-mermaid/pull/1125) [`c2a190d`](https://github.com/dfadler/zombie-mermaid/commit/c2a190df3c86e7b3394e853d437fc3d11b7634e4) Thanks [@dfadler](https://github.com/dfadler)! - Removed `mixHexColors` from `@zombie-mermaid/mermaid-parser`'s public exports. It was a dead duplicate of `@zombie-mermaid/core`'s `mixHexColors` (different argument order/scale, same job) with zero callers anywhere in this repo, including its own module. If you were importing `mixHexColors` from `@zombie-mermaid/mermaid-parser`, use `@zombie-mermaid/core`'s `mixHexColors(fg, bg, pct)` instead (note: percentage 0-100, not ratio 0-1, and argument order is reversed).

### Patch Changes

- Updated dependencies [[`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130)]:
  - @zombie-mermaid/core@3.0.0

## 2.2.6

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.6

## 2.2.5

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.5

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
