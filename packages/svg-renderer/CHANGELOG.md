# @zombie-mermaid/svg-renderer

## 4.2.1

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@4.2.1
  - @zombie-mermaid/mermaid-parser@4.2.1

## 4.2.0

### Minor Changes

- [#1376](https://github.com/dfadler/zombie-mermaid/pull/1376) [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 2: SVG rendering. `renderMermaidSVG` now draws `pie` charts with Mermaid's own layout: slices in source order, clockwise from 12 o'clock, each labelled inside with its whole-number percentage; slices under 1% of the total left out of the pie but kept in the legend; a legend on the right listing every slice (`label [value]` with `showData`); the title above the pie; and an empty circle for a chart with no slices. Colours follow the theme: the accent, then the XY chart series shades, repeating after 12, at Mermaid's 0.7 slice opacity with a 2px outline. Mermaid's `accTitle` becomes the SVG's accessible name (unless the `title` option is given) and `accDescr` its description. `@zombie-mermaid/mermaid-parser` adds the `PositionedPieChart`/`PositionedPieSlice`/`PositionedPieLegendItem` types, `@zombie-mermaid/svg-renderer` exports `layoutPieChart` and `renderPieSvg`, and `@zombie-mermaid/core`'s `svgOpenTag` takes an optional `description` that emits a `<desc>` referenced by `aria-describedby`. The flowchart parser's unknown-header error now lists `pie`. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy and [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.

### Patch Changes

- [#1371](https://github.com/dfadler/zombie-mermaid/pull/1371) [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 1: parsing and detection. `DiagramType` gains `'pie'`, and `detectDiagramType` routes a `pie` header to it (case-sensitively, as Mermaid does). `@zombie-mermaid/mermaid-parser` adds `parsePieChart` with the `PieChart`/`PieSlice` types (title, accTitle, accDescr, showData, slices in source order). The parser accepts and rejects the same input as Mermaid's own pie grammar: labels must be quoted, negative values are errors, zero is allowed, a repeated label keeps its first value, `showData` is only valid on the header line, and a bare `pie` with no slices is valid. `renderMermaidSVG` and `renderMermaidASCII` route a pie chart to the pie parser (so syntax errors are reported with their line) instead of misrouting it to the flowchart parser; the rendering itself is covered by the separate pie SVG and ASCII renderer changesets. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with strictness ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.
- Updated dependencies [[`700b97b`](https://github.com/dfadler/zombie-mermaid/commit/700b97bcbf5adeec39a438e7257fff71deff6fb6), [`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2), [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7), [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64)]:
  - @zombie-mermaid/mermaid-parser@4.2.0
  - @zombie-mermaid/core@4.2.0

## 4.1.0

### Minor Changes

- [#1324](https://github.com/dfadler/zombie-mermaid/pull/1324) [`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277) Thanks [@dfadler](https://github.com/dfadler)! - Move the embedded mono font subset out of `core` into `svg-renderer` ([#1319](https://github.com/dfadler/zombie-mermaid/issues/1319)). `core`'s `buildStyleBlock(font, mono, nonce?)` now takes `mono: MonoFontEmbed | false` (a `{ family, faceCss }` object) instead of a `hasMonoFont` boolean, and `core` no longer ships the base64 font data, so ASCII-only consumers never carry it. `svg-renderer` exports `buildSvgStyleBlock(font, hasMonoFont, nonce?)`, which keeps the previous boolean API and emits byte-identical SVG output.

### Patch Changes

- [#1333](https://github.com/dfadler/zombie-mermaid/pull/1333) [`7ab83e5`](https://github.com/dfadler/zombie-mermaid/commit/7ab83e5a56f03ced457aa310dfb7ce27b3a87fb6) Thanks [@dfadler](https://github.com/dfadler)! - Flowchart: edges leaving a node are no longer merged onto one trunk when another edge (such as a return edge) ends on the same side of that node, so the git branching sample's branches and its `approved` arrow stay distinct.

- [#1329](https://github.com/dfadler/zombie-mermaid/pull/1329) [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36) Thanks [@dfadler](https://github.com/dfadler)! - SVG: an edge between a node and a subgraph that contains it (`B --> Sub` with `B` inside `Sub`, or `Sub --> B`, or between nested subgraphs) is no longer drawn as a degenerate stub. Real mermaid.js 11.17.2 draws no line for it (a zero-length path), and now both renderers omit it through one shared check in `@zombie-mermaid/core` ([#1310](https://github.com/dfadler/zombie-mermaid/issues/1310)).

  SVG: the gap cut in an edge where it crosses a subgraph title ([#1239](https://github.com/dfadler/zombie-mermaid/issues/1239)) is now only cut when the edge passes through the title text itself, not when it merely runs through the 2px clearance beside it.

- Updated dependencies [[`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277), [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36)]:
  - @zombie-mermaid/core@4.1.0
  - @zombie-mermaid/mermaid-parser@4.1.0

## 4.0.0

### Minor Changes

- [#1296](https://github.com/dfadler/zombie-mermaid/pull/1296) [`642a1a9`](https://github.com/dfadler/zombie-mermaid/commit/642a1a9ea83e118e1414a0f05031b71a60289edd) Thanks [@dfadler](https://github.com/dfadler)! - ER diagrams with no `direction` statement now lay out top to bottom, as official Mermaid does, instead of left to right. Add `direction LR` to the source (or pass the `direction` render option) to keep the old horizontal layout. The ASCII renderer is unchanged.

### Patch Changes

- [#1294](https://github.com/dfadler/zombie-mermaid/pull/1294) [`7ae4525`](https://github.com/dfadler/zombie-mermaid/commit/7ae45258a332b07ac546da11d8936946d36949d0) Thanks [@dfadler](https://github.com/dfadler)! - C4 SVG relationship labels no longer sit on a shape. Mermaid starts a label at the middle of its line, which lands on a neighbouring shape (the Database cylinder in the Container sample) when a line is short or passes through another shape; the label now slides along its line to the nearest spot clear of every shape and of other labels. A label that already clears everything stays where Mermaid puts it.

- [#1279](https://github.com/dfadler/zombie-mermaid/pull/1279) [`43475ff`](https://github.com/dfadler/zombie-mermaid/commit/43475ff759b6f52d41d2c7c2911dae963a6c6ef2) Thanks [@dfadler](https://github.com/dfadler)! - C4 SVG relationships now end on a cylinder (`SystemDb`, `ContainerDb`), a pipe (`SystemQueue`, `ContainerQueue`) and a person where Mermaid ends them, following the shape's own outline at oblique angles instead of the box around it. A line into the top of a database used to stop up to 15px short of where Mermaid ends it.

- [#1281](https://github.com/dfadler/zombie-mermaid/pull/1281) [`6cdacb6`](https://github.com/dfadler/zombie-mermaid/commit/6cdacb6a2dcd857d4328a2890cc29d290274bfe4) Thanks [@dfadler](https://github.com/dfadler)! - C4 SVG shapes now size their text the way Mermaid does: widths are summed from Arial advances (regular and bold) instead of a scaled Inter estimate, and a name or description wraps at the shape width less its padding (176px) judged at regular weight, so a bold name can run past it. A person with a three-line description is 216px wide as in Mermaid (it was 222px), and a very long label no longer makes the whole diagram about 10px wider.

- [#1257](https://github.com/dfadler/zombie-mermaid/pull/1257) [`f768c85`](https://github.com/dfadler/zombie-mermaid/commit/f768c85ebaeafe720db67ece57c51c26fb2dad28) Thanks [@dfadler](https://github.com/dfadler)! - SVG class diagrams: disconnected components are now laid out left to right in the order they are declared, as Mermaid does, instead of being reordered and wrapped onto a second row. Closes [#1249](https://github.com/dfadler/zombie-mermaid/issues/1249).

- [#1255](https://github.com/dfadler/zombie-mermaid/pull/1255) [`5e42179`](https://github.com/dfadler/zombie-mermaid/commit/5e42179d915ae3a386e7df48314794413ddbd94b) Thanks [@dfadler](https://github.com/dfadler)! - Class diagram boxes are now sized for whole-pixel glyph advances, so a long member line (`+ handleInput(event): void`) keeps its right padding instead of running into the border where the browser doesn't position glyphs at subpixel offsets (headless Chromium on Linux).

- [#1299](https://github.com/dfadler/zombie-mermaid/pull/1299) [`c7d9704`](https://github.com/dfadler/zombie-mermaid/commit/c7d9704c9cbc9f39d3408a0d4cac124e2e1852dc) Thanks [@dfadler](https://github.com/dfadler)! - Class diagram SVG now draws `namespace Name { ... }` blocks as a titled frame around their member classes, as Mermaid does. Previously the blocks were parsed but never drawn. `PositionedClassDiagram` gains a `namespaces` array carrying each frame's geometry.

- [#1261](https://github.com/dfadler/zombie-mermaid/pull/1261) [`f244b08`](https://github.com/dfadler/zombie-mermaid/commit/f244b089f6fc4c4a24bb25da961d9018077ade03) Thanks [@dfadler](https://github.com/dfadler)! - Make class-diagram visibility markers (`+`, `-`, `#`, `~`) legible in SVG output: they are drawn bold in the member-name colour instead of faint, so `~` no longer reads like `-` at 1x.

- [#1271](https://github.com/dfadler/zombie-mermaid/pull/1271) [`26e2a77`](https://github.com/dfadler/zombie-mermaid/commit/26e2a7753a87f91bd3de6134c59c8e12e4d249a3) Thanks [@dfadler](https://github.com/dfadler)! - ER entity boxes are now sized for whole-pixel glyph advances, so a long attribute row (`varchar(255)  emailAddressPrimary`) keeps its padding instead of the type running into the name where the browser doesn't position glyphs at subpixel offsets (headless Chromium on Linux).

- [#1276](https://github.com/dfadler/zombie-mermaid/pull/1276) [`89e915f`](https://github.com/dfadler/zombie-mermaid/commit/89e915ff838a140dbac4bc6452e4460cf766693c) Thanks [@dfadler](https://github.com/dfadler)! - ER relationship labels are now dark enough to pass WCAG AA (4.5:1) on the default theme, and the third series in an XY chart is a distinct sky blue instead of a second light blue close to the first series.

- [#1313](https://github.com/dfadler/zombie-mermaid/pull/1313) [`e894cf0`](https://github.com/dfadler/zombie-mermaid/commit/e894cf060c0fc25254250a9894d39cef0c13a0d2) Thanks [@dfadler](https://github.com/dfadler)! - A flowchart with a cycle is no longer drawn upside down when ELK reverses the wrong edge. Cycles are now broken the way mermaid.js breaks them: a depth-first walk reverses the edge that points back at a node still on the walk's stack, and ELK is given those edges already reversed (each is flipped back afterwards, so it still runs from its source to its target). In the Git Branching sample the flow now reads left to right from `main` through `develop` and the feature branches to `PR Review`, instead of starting with `Tests?` at the far left. State diagrams and graphs with a subgraph direction override are unchanged.

- [#1315](https://github.com/dfadler/zombie-mermaid/pull/1315) [`56d3b72`](https://github.com/dfadler/zombie-mermaid/commit/56d3b7287bd7aba20256ad054630635ece2826e1) Thanks [@dfadler](https://github.com/dfadler)! - A flowchart with subgraphs is now arranged the way mermaid.js arranges it. ELK laid a subgraph's contents out as a block before the nodes around it, so a node outside a subgraph could never sit beside one inside it. The whole graph is now laid out flat and each subgraph is drawn as a box around its members, with the other nodes kept clear of the box. In the CI/CD sample, `Deploy Staging`, `QA Approved?` and `Production` form a column beside the pipeline's box and `Fix & Retry` sits at its bottom, as in mermaid.js. Sibling subgraphs side by side are drawn in mermaid.js's order. Diagrams the new layout can't handle (a subgraph with its own direction, an edge to a subgraph, state diagrams) or can't fit keep the previous layout; architecture diagrams are unchanged. Exports `layoutFlowchartSync`.

- [#1306](https://github.com/dfadler/zombie-mermaid/pull/1306) [`66411fb`](https://github.com/dfadler/zombie-mermaid/commit/66411fb023e7d6eed50957a0fd6e934572254c0a) Thanks [@dfadler](https://github.com/dfadler)! - An edge that runs over a subgraph's title text no longer obscures it. The edge is not painted over the text itself and carries on past it, using an SVG mask, so its path and element are unchanged (the `No` edge into "Fix & Retry" in the CI/CD sample, the edges into the "US West Region" and "US East Region" subgraphs). Diagrams where no edge crosses a title are unchanged.

- [#1277](https://github.com/dfadler/zombie-mermaid/pull/1277) [`c2980a2`](https://github.com/dfadler/zombie-mermaid/commit/c2980a26503ab5c7a4a38407ee29feec128ba7d6) Thanks [@dfadler](https://github.com/dfadler)! - Sequence diagrams no longer draw lifelines through message labels, self-message labels, block title tabs or `else`/`and` labels, and a stick-figure actor's label now has room above the first message instead of sitting on its arrow.

- [#1258](https://github.com/dfadler/zombie-mermaid/pull/1258) [`7e4db32`](https://github.com/dfadler/zombie-mermaid/commit/7e4db3206ab61740b54f427003ab3fb248001d66) Thanks [@dfadler](https://github.com/dfadler)! - Sequence diagrams: a nested activation (for example `S->>+S` while `S` is already active) now draws an outer bar and a nested bar offset half a bar to the right, as official Mermaid does. Before, the nested bar was offset only 4px and painted underneath its parent, so it showed as a sliver and read as a single bar. The positioned `Activation` gains a `depth` field. Closes [#1241](https://github.com/dfadler/zombie-mermaid/issues/1241).

- [#1295](https://github.com/dfadler/zombie-mermaid/pull/1295) [`426b6bb`](https://github.com/dfadler/zombie-mermaid/commit/426b6bb6ba868af9e9e4dc295ac64dca4111654d) Thanks [@dfadler](https://github.com/dfadler)! - SVG state diagrams: composite states now follow the same top-to-bottom reading order as flat state diagrams, so a composite no longer pushes the states after it upside down. Closes [#1287](https://github.com/dfadler/zombie-mermaid/issues/1287).

- [#1292](https://github.com/dfadler/zombie-mermaid/pull/1292) [`cff9e1f`](https://github.com/dfadler/zombie-mermaid/commit/cff9e1ffb2c78861b14c392d866497cb4995f03a) Thanks [@dfadler](https://github.com/dfadler)! - In state diagrams without composite states, the end marker (`[*]` as a transition target) now sits right after the state that transitions into it instead of at the very bottom of the page, so `Closed --> [*]` is a short edge rather than a long line down the page edge.

- [#1280](https://github.com/dfadler/zombie-mermaid/pull/1280) [`ed7f645`](https://github.com/dfadler/zombie-mermaid/commit/ed7f6458ed983e25d55b0ca2e6c0cae2cfd63d88) Thanks [@dfadler](https://github.com/dfadler)! - State diagrams without composite states now read top to bottom: the `[*]` start marker leads and the end marker trails, and a back-edge such as `Active --> Idle` no longer flips the main chain upside down. State edges also stop ending in a sideways arrowhead after layout compaction.

- [#1260](https://github.com/dfadler/zombie-mermaid/pull/1260) [`7b796fa`](https://github.com/dfadler/zombie-mermaid/commit/7b796fac35b99f1e1dcd5fa9f54838c1d1a9dc3e) Thanks [@dfadler](https://github.com/dfadler)! - XY chart x-axis labels no longer run together when there are many categories: when the widest label would leave less than 8px to its neighbour, the chart shows every n-th label instead.
- Updated dependencies [[`20db743`](https://github.com/dfadler/zombie-mermaid/commit/20db743be4508a59d57bfe81a97fb916910b2a54), [`c7d9704`](https://github.com/dfadler/zombie-mermaid/commit/c7d9704c9cbc9f39d3408a0d4cac124e2e1852dc), [`89e915f`](https://github.com/dfadler/zombie-mermaid/commit/89e915ff838a140dbac4bc6452e4460cf766693c), [`7e4db32`](https://github.com/dfadler/zombie-mermaid/commit/7e4db3206ab61740b54f427003ab3fb248001d66)]:
  - @zombie-mermaid/mermaid-parser@4.0.0
  - @zombie-mermaid/core@4.0.0

## 3.2.0

### Minor Changes

- [#1195](https://github.com/dfadler/zombie-mermaid/pull/1195) [`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9) Thanks [@dfadler](https://github.com/dfadler)! - Add `architecture-beta` diagrams (Mermaid's native syntax: `group`, `service`, `junction`, port-sided edges, `{group}` edges). They are lowered to the flowchart model and render in SVG and ASCII; ports steer flow direction rather than an exact grid, and icons are not drawn. `DIAGRAM_TYPES` gains `'architecture'`.

- [#1192](https://github.com/dfadler/zombie-mermaid/pull/1192) [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1) Thanks [@dfadler](https://github.com/dfadler)! - Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII with dedicated renderers. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, which records `Rel_U/D/L/R` placement hints. The SVG renderer lays out with ELK (nested boundaries, relationships to boundaries) and draws a person glyph, cylinders, queues, the C4 palette, boundary frames, a title, and relationship labels with a separate `[technology]` line. The ASCII renderer has its own row layout, boxes, boundary frames, and grid router. `Rel_D`/`Rel_U` steer layering; `Rel_R`/`Rel_L` place elements side by side (exact in ASCII, a best-effort nudge in SVG). Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (devx), both unmerged upstream; nothing was copied from either renderer; the parser and integration fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (adapted, with known gaps marked as skipped). ArchiMate remains open under [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167).

### Patch Changes

- [#1204](https://github.com/dfadler/zombie-mermaid/pull/1204) [`54432b6`](https://github.com/dfadler/zombie-mermaid/commit/54432b6206c1af5d2e2d4fdd447256d9bbbcc85b) Thanks [@dfadler](https://github.com/dfadler)! - C4 SVG output now follows Mermaid's own C4 renderer instead of a layered graph layout. Shapes are placed in rows in declaration order (four to a row, boundaries two to a row), sized as Mermaid sizes them (216px wide, wider when the text is), and drawn the way Mermaid draws them: rounded boxes, a pill with a round head for a person, cylinders and pipes, dashed boundary frames with a centred title and type, a straight first relationship with curved ones after it, and plain-text labels. As in Mermaid, `Rel_U/D/L/R` and `RenderOptions.direction` do not move anything in the SVG. ASCII output is unchanged.

- [#1247](https://github.com/dfadler/zombie-mermaid/pull/1247) [`cdd34dd`](https://github.com/dfadler/zombie-mermaid/commit/cdd34dd8c93ec3768320b6b23384f143e2180db5) Thanks [@dfadler](https://github.com/dfadler)! - Fix class-diagram composition (`*--`) and aggregation (`o--`) markers being hidden in SVG output. The diamond markers were anchored at the wrong end (`refX="0"`), so the whole diamond sat under the class box; they now put the tip on the line's endpoint like the inheritance triangle.

- [#1246](https://github.com/dfadler/zombie-mermaid/pull/1246) [`b4903df`](https://github.com/dfadler/zombie-mermaid/commit/b4903df714cefa036f33e54081b97b56f2248cab) Thanks [@dfadler](https://github.com/dfadler)! - ER diagrams: the one-or-many cardinality (`|{` and `}|`) is now drawn as a crow's foot plus a bar, instead of a bare crow's foot that read as zero-or-many. Closes [#1233](https://github.com/dfadler/zombie-mermaid/issues/1233).

- [#1245](https://github.com/dfadler/zombie-mermaid/pull/1245) [`b88c5bc`](https://github.com/dfadler/zombie-mermaid/commit/b88c5bc2e28cff949282516984fba9d47bb46416) Thanks [@dfadler](https://github.com/dfadler)! - Fix XY chart value-axis tick labels repeating when the data range is narrow. Labels now take their precision from the tick step instead of rounding to whole numbers above 10, so a 99-102 range reads `99, 99.5, 100, ...` and a single value no longer shows the same number at every tick.

- [#1236](https://github.com/dfadler/zombie-mermaid/pull/1236) [`aea9109`](https://github.com/dfadler/zombie-mermaid/commit/aea9109b754cf231ebc7a4fababf5819487febd0) Thanks [@dfadler](https://github.com/dfadler)! - XY chart line series now use monotone cubic interpolation, so the smoothed curve no longer overshoots the data (a peak above the maximum, or a dip below a zero baseline).
- Updated dependencies [[`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9), [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1), [`54432b6`](https://github.com/dfadler/zombie-mermaid/commit/54432b6206c1af5d2e2d4fdd447256d9bbbcc85b), [`f01ed87`](https://github.com/dfadler/zombie-mermaid/commit/f01ed8761b156c33d88a3b9fb9bc21c805675085)]:
  - @zombie-mermaid/core@3.2.0
  - @zombie-mermaid/mermaid-parser@3.2.0

## 3.1.0

### Patch Changes

- [#1163](https://github.com/dfadler/zombie-mermaid/pull/1163) [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34) Thanks [@dfadler](https://github.com/dfadler)! - Round every coordinate/dimension interpolated into generated SVG markup (flowchart, ER, class, and sequence diagrams) to 2 decimal places instead of emitting full floating-point precision (e.g. `142.38427299999998`). Output is visually identical — 2 decimal places is well beyond the smallest rendering difference a browser draws — but noticeably smaller and easier to read or diff by hand. `xychart`'s own existing rounding is unchanged. (Ported from a fix by GauBen, upstream [lukilabs/beautiful-mermaid#77](https://github.com/lukilabs/beautiful-mermaid/pull/77).)
- Updated dependencies [[`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e), [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34)]:
  - @zombie-mermaid/core@3.1.0
  - @zombie-mermaid/mermaid-parser@3.1.0

## 3.0.0

### Minor Changes

- [#1128](https://github.com/dfadler/zombie-mermaid/pull/1128) [`d9e306f`](https://github.com/dfadler/zombie-mermaid/commit/d9e306f91003c9e47da10944833f76c2b87ace22) Thanks [@dfadler](https://github.com/dfadler)! - Add `renderMermaidSVG(text, options)` — a single "Mermaid text in, SVG out" entry point, for parity with `@zombie-mermaid/ascii-renderer`'s `renderMermaidASCII`. Previously this package only exported the lower-level per-diagram-type `layout*Sync()`/`render*Svg()` pairs; diagram-type detection and dispatch had to be assembled by hand or via the `zombie-mermaid` umbrella package. Also adds `renderMermaidSVGAsync` and `themeCssVariables`, and the deprecated `renderMermaidSync`/`renderMermaid` aliases.

### Patch Changes

- [#1157](https://github.com/dfadler/zombie-mermaid/pull/1157) [`87f74e4`](https://github.com/dfadler/zombie-mermaid/commit/87f74e42c9cccbdd677ab2af17f4b3c415350948) Thanks [@dfadler](https://github.com/dfadler)! - Fix edge endpoints and labels landing off a nested subgraph's boundary instead of on it, for a flowchart with no `direction` override on any subgraph. ELK can leave a cross-hierarchy edge in an ancestor container's `edges` array while reporting its routed points/label in the coordinate space of the deeper container it actually belongs to; layout conversion now honors that declared container offset instead of the owning array's offset. (Ported from a fix by Galen Suen, upstream [lukilabs/beautiful-mermaid#152](https://github.com/lukilabs/beautiful-mermaid/pull/152).)
- Updated dependencies [[`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130), [`c2a190d`](https://github.com/dfadler/zombie-mermaid/commit/c2a190df3c86e7b3394e853d437fc3d11b7634e4)]:
  - @zombie-mermaid/core@3.0.0
  - @zombie-mermaid/mermaid-parser@3.0.0

## 2.2.6

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.6
  - @zombie-mermaid/mermaid-parser@2.2.6

## 2.2.5

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.5
  - @zombie-mermaid/mermaid-parser@2.2.5

## 2.2.1

### Patch Changes

- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66), [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043)]:
  - @zombie-mermaid/core@2.2.1
  - @zombie-mermaid/mermaid-parser@2.2.1
