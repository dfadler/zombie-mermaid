# @zombie-mermaid/core

## 5.0.2

## 5.0.1

## 5.0.0

### Major Changes

- [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444) [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1) Thanks [@dfadler](https://github.com/dfadler)! - **BREAKING:** `elkjs` is now an optional peer dependency of `@zombie-mermaid/svg-renderer` (and no longer a dependency of `@zombie-mermaid/core`), and the library no longer imports it. Browser and bundler apps that render flowchart, state, class, ER or architecture diagrams must `npm install elkjs` and call the new `registerElk(ELK)` once (`import ELK from 'elkjs/lib/elk.bundled.js'`); otherwise rendering those diagrams throws `ElkNotRegisteredError`. Under Node and Bun, `elkjs` is auto-loaded when installed, and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so the CLI and MCP server need no change. Sequence, pie, xychart, C4 and ASCII output never needed it. In exchange, the SVG renderer's browser bundle drops from about 518 KB to 74 KB gzipped (umbrella 576 KB to 130 KB) when elk is not registered, and the published `.d.ts` files no longer import from `elkjs` (the `Elk*` graph types are now exported by `@zombie-mermaid/core`). See `docs/guides/elkjs-optional-peer.md`.

### Patch Changes

- [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3) Thanks [@dfadler](https://github.com/dfadler)! - Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop the unused `entities` dependency declaration from mcp (refs [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426)).

## 4.2.3

## 4.2.2

## 4.2.1

## 4.2.0

### Minor Changes

- [#1371](https://github.com/dfadler/zombie-mermaid/pull/1371) [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 1: parsing and detection. `DiagramType` gains `'pie'`, and `detectDiagramType` routes a `pie` header to it (case-sensitively, as Mermaid does). `@zombie-mermaid/mermaid-parser` adds `parsePieChart` with the `PieChart`/`PieSlice` types (title, accTitle, accDescr, showData, slices in source order). The parser accepts and rejects the same input as Mermaid's own pie grammar: labels must be quoted, negative values are errors, zero is allowed, a repeated label keeps its first value, `showData` is only valid on the header line, and a bare `pie` with no slices is valid. `renderMermaidSVG` and `renderMermaidASCII` route a pie chart to the pie parser (so syntax errors are reported with their line) instead of misrouting it to the flowchart parser; the rendering itself is covered by the separate pie SVG and ASCII renderer changesets. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with strictness ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.

- [#1376](https://github.com/dfadler/zombie-mermaid/pull/1376) [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 2: SVG rendering. `renderMermaidSVG` now draws `pie` charts with Mermaid's own layout: slices in source order, clockwise from 12 o'clock, each labelled inside with its whole-number percentage; slices under 1% of the total left out of the pie but kept in the legend; a legend on the right listing every slice (`label [value]` with `showData`); the title above the pie; and an empty circle for a chart with no slices. Colours follow the theme: the accent, then the XY chart series shades, repeating after 12, at Mermaid's 0.7 slice opacity with a 2px outline. Mermaid's `accTitle` becomes the SVG's accessible name (unless the `title` option is given) and `accDescr` its description. `@zombie-mermaid/mermaid-parser` adds the `PositionedPieChart`/`PositionedPieSlice`/`PositionedPieLegendItem` types, `@zombie-mermaid/svg-renderer` exports `layoutPieChart` and `renderPieSvg`, and `@zombie-mermaid/core`'s `svgOpenTag` takes an optional `description` that emits a `<desc>` referenced by `aria-describedby`. The flowchart parser's unknown-header error now lists `pie`. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy and [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.

### Patch Changes

- [#1368](https://github.com/dfadler/zombie-mermaid/pull/1368) [`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2) Thanks [@dfadler](https://github.com/dfadler)! - Flowchart and state labels now decode Mermaid's entity codes (`#quot;`, `#lt;`, `#gt;`, `[#35](https://github.com/dfadler/zombie-mermaid/issues/35);`, `#x5B;`) instead of printing them literally, and ASCII output decodes `&quot;`/`&lt;`-style entities in labels as SVG already did. Decoding runs per label after parsing, ignores out-of-range code points, and never touches style lines. Idea from [lukilabs/beautiful-mermaid#158](https://github.com/lukilabs/beautiful-mermaid/pull/158) by thiccyoda.

## 4.1.0

### Minor Changes

- [#1324](https://github.com/dfadler/zombie-mermaid/pull/1324) [`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277) Thanks [@dfadler](https://github.com/dfadler)! - Move the embedded mono font subset out of `core` into `svg-renderer` ([#1319](https://github.com/dfadler/zombie-mermaid/issues/1319)). `core`'s `buildStyleBlock(font, mono, nonce?)` now takes `mono: MonoFontEmbed | false` (a `{ family, faceCss }` object) instead of a `hasMonoFont` boolean, and `core` no longer ships the base64 font data, so ASCII-only consumers never carry it. `svg-renderer` exports `buildSvgStyleBlock(font, hasMonoFont, nonce?)`, which keeps the previous boolean API and emits byte-identical SVG output.

### Patch Changes

- [#1329](https://github.com/dfadler/zombie-mermaid/pull/1329) [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36) Thanks [@dfadler](https://github.com/dfadler)! - SVG: an edge between a node and a subgraph that contains it (`B --> Sub` with `B` inside `Sub`, or `Sub --> B`, or between nested subgraphs) is no longer drawn as a degenerate stub. Real mermaid.js 11.17.2 draws no line for it (a zero-length path), and now both renderers omit it through one shared check in `@zombie-mermaid/core` ([#1310](https://github.com/dfadler/zombie-mermaid/issues/1310)).

  SVG: the gap cut in an edge where it crosses a subgraph title ([#1239](https://github.com/dfadler/zombie-mermaid/issues/1239)) is now only cut when the edge passes through the title text itself, not when it merely runs through the 2px clearance beside it.

## 4.0.0

## 3.2.0

### Minor Changes

- [#1195](https://github.com/dfadler/zombie-mermaid/pull/1195) [`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9) Thanks [@dfadler](https://github.com/dfadler)! - Add `architecture-beta` diagrams (Mermaid's native syntax: `group`, `service`, `junction`, port-sided edges, `{group}` edges). They are lowered to the flowchart model and render in SVG and ASCII; ports steer flow direction rather than an exact grid, and icons are not drawn. `DIAGRAM_TYPES` gains `'architecture'`.

- [#1192](https://github.com/dfadler/zombie-mermaid/pull/1192) [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1) Thanks [@dfadler](https://github.com/dfadler)! - Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII with dedicated renderers. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, which records `Rel_U/D/L/R` placement hints. The SVG renderer lays out with ELK (nested boundaries, relationships to boundaries) and draws a person glyph, cylinders, queues, the C4 palette, boundary frames, a title, and relationship labels with a separate `[technology]` line. The ASCII renderer has its own row layout, boxes, boundary frames, and grid router. `Rel_D`/`Rel_U` steer layering; `Rel_R`/`Rel_L` place elements side by side (exact in ASCII, a best-effort nudge in SVG). Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (devx), both unmerged upstream; nothing was copied from either renderer; the parser and integration fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (adapted, with known gaps marked as skipped). ArchiMate remains open under [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167).

### Patch Changes

- [#1178](https://github.com/dfadler/zombie-mermaid/pull/1178) [`f01ed87`](https://github.com/dfadler/zombie-mermaid/commit/f01ed8761b156c33d88a3b9fb9bc21c805675085) Thanks [@dfadler](https://github.com/dfadler)! - State diagrams now honor `classDef`, `class A,B name`, and the `State:::name` shorthand (including `S1:::foo --> S2`, which previously swallowed `S1` into a bogus `::foo --> S2` state). Styling is applied in SVG through the same shared style helpers flowcharts use; ASCII follows its flowchart behavior. Closes [#1171](https://github.com/dfadler/zombie-mermaid/issues/1171).

## 3.1.0

### Minor Changes

- [#1173](https://github.com/dfadler/zombie-mermaid/pull/1173) [`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: `render_mermaid_svg` gains optional `bg`/`fg` hex color overrides (applied on top of `theme`) and an optional `outputPath` that writes the SVG to a `.svg` file and returns `{ saved, size }`. `outputPath` is path-safe: it must resolve inside the server's working directory, the parent must already exist, and symlinks, `..` traversal, and non-regular files are refused. Because it can write files, `render_mermaid_svg` is now annotated `readOnlyHint: false, destructiveHint: true`. Two new tools, `list_themes` and `list_diagram_types`, list the valid `theme` names and the supported diagram types. `@zombie-mermaid/core` now exports a runtime `DIAGRAM_TYPES` array that `DiagramType` is derived from.

  Adapted by hand (not imported) from upstream lukilabs/beautiful-mermaid#120 (by LordCasser) and [#42](https://github.com/dfadler/zombie-mermaid/issues/42) (by manuareraa), keeping this fork's camelCase inputs and enum theme validation.

### Patch Changes

- [#1163](https://github.com/dfadler/zombie-mermaid/pull/1163) [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34) Thanks [@dfadler](https://github.com/dfadler)! - Round every coordinate/dimension interpolated into generated SVG markup (flowchart, ER, class, and sequence diagrams) to 2 decimal places instead of emitting full floating-point precision (e.g. `142.38427299999998`). Output is visually identical — 2 decimal places is well beyond the smallest rendering difference a browser draws — but noticeably smaller and easier to read or diff by hand. `xychart`'s own existing rounding is unchanged. (Ported from a fix by GauBen, upstream [lukilabs/beautiful-mermaid#77](https://github.com/lukilabs/beautiful-mermaid/pull/77).)

## 3.0.0

### Major Changes

- [#1122](https://github.com/dfadler/zombie-mermaid/pull/1122) [`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130) Thanks [@dfadler](https://github.com/dfadler)! - Remove the unused `componentSpacing` field from `RenderOptions` /
  `FlowchartRenderOptions`. It was a no-op accepted only for forward
  compatibility and was never read by any renderer. This narrows the public
  `FlowchartRenderOptions` type — a TypeScript consumer passing
  `componentSpacing` in a strictly-typed object literal will now see a type
  error, though no runtime behavior changes since the field was never used.

## 2.2.6

## 2.2.5

## 2.2.1

### Patch Changes

- [#1069](https://github.com/dfadler/zombie-mermaid/pull/1069) [`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66) Thanks [@dfadler](https://github.com/dfadler)! - Fix diagonal edge-routing arrowheads (`◢◣◤◥`) falling back to an unpinned
  system font in ASCII output: JetBrains Mono NL has no glyph for them at
  all ([#1062](https://github.com/dfadler/zombie-mermaid/issues/1062)), so `drawArrowHead` now draws `↖↗↘↙` instead — real,
  correctly-directional glyphs the font does have. Also fixes an
  `isWideChar` misclassification the new glyphs would otherwise hit.
