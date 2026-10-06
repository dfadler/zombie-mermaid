# @zombie-mermaid/core

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
