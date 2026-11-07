# @zombie-mermaid/core

## 5.15.0

### Minor Changes

- [#2765](https://github.com/dfadler/zombie-mermaid/pull/2765) [`23f680d`](https://github.com/dfadler/zombie-mermaid/commit/23f680d5cc57a4661021229f46ec7e00b9caf7d0) Thanks [@dfadler](https://github.com/dfadler)! - Output change: `%%{init: {"flowchart": {"curve": ...}}}%%` (and front-matter `config.flowchart.curve`) no longer changes flowchart edges, matching Mermaid 12.3.0, which draws the same rounded orthogonal edges for every value. The `curve` render option still applies. `InitConfig.curve` and `applyInitConfig` are removed; the key is reported in `InitConfig.ignored`.

- [#2873](https://github.com/dfadler/zombie-mermaid/pull/2873) [`6fdbf16`](https://github.com/dfadler/zombie-mermaid/commit/6fdbf16284b19b7250f2adfd0f37a7a5179cdb39) Thanks [@dfadler](https://github.com/dfadler)! - Gantt charts. `gantt` diagrams now parse and render to SVG and ASCII/Unicode text ([#2835](https://github.com/dfadler/zombie-mermaid/issues/2835), under [#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'gantt'` and `detectDiagramType` routes a `gantt` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseGantt` with the `GanttChart` and `Positioned*` types and the date helpers it is built on (`parseDayjs`, `formatDayjs`, `formatD3Time`, `timeTicks`): `dateFormat`, `axisFormat`, `tickInterval`, `excludes` / `includes`, `weekday` / `weekend`, `inclusiveEndDates`, `todayMarker`, `topAxis`, sections, the `active` / `done` / `crit` / `milestone` / `vert` tags, `after` / `until` references and durations, `click`, and the `gantt` keys of `%%{init}%%` and front matter that change what is drawn. The SVG uses Mermaid's geometry and d3 time axis, checked against mermaid 12.3.0 by the new `pnpm run gantt:oracle` (rows, bars, shaded days, ticks and labels match exactly), and the theme's colour variables. The ASCII output is this library's own design: a 60-column timeline with distinct glyphs per task state. Dates are UTC and the frame is a fixed 1200px wide; `topAxis` works here although mermaid 12.3.0 fails on that statement; see `docs/known-differences.md`.

- [#2872](https://github.com/dfadler/zombie-mermaid/pull/2872) [`bfed790`](https://github.com/dfadler/zombie-mermaid/commit/bfed79057d20e563635fc9a64cae5aba34d8172d) Thanks [@dfadler](https://github.com/dfadler)! - Mindmaps. `mindmap` diagrams now parse and render to SVG and ASCII/Unicode text ([#2840](https://github.com/dfadler/zombie-mermaid/issues/2840), under [#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'mindmap'` and `detectDiagramType` routes a `mindmap` header to it. `@zombie-mermaid/mermaid-parser` adds `parseMindmap` with the `Mindmap`, `MindmapNode` and `Positioned*` types, a port of Mermaid's jison grammar (all seven shapes, `::icon()`, `:::class`, quoted and Markdown labels, Mermaid's indentation rules and its "only one root" error). The SVG renderer draws Mermaid 12.3.0's mindmap: its node shapes and sizes, its colour sections and edge widths, and its layout, a dependency-free port of the CoSE-Bilkent force layout Mermaid runs through cytoscape (bit-identical to it for a tree). `pnpm run mindmap:oracle` checks every sample against real mermaid (12.1.0, GitHub's version, 12.2.0 and 12.3.0 render mindmaps identically): structure exactly, shapes and layout from Mermaid's own measured node sizes. Colours follow the theme and label widths use this library's font, so positions drift from Mermaid's by the text-width difference; the ASCII output is an indented tree (Mermaid has none). See `docs/known-differences.md`.

- [#2876](https://github.com/dfadler/zombie-mermaid/pull/2876) [`4b32ef5`](https://github.com/dfadler/zombie-mermaid/commit/4b32ef5899910e064be2bc17e447532e52643ace) Thanks [@dfadler](https://github.com/dfadler)! - Timelines. `timeline` and `timeline TD` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2845](https://github.com/dfadler/zombie-mermaid/issues/2845)). `DiagramType` gains `'timeline'` and `detectDiagramType` routes a `timeline` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseTimeline` with the `Timeline` and `Positioned*` types, a port of Mermaid's lexer and database: `title`, `section`, periods with `: event` parts and continuation lines, `%%` comments, a `#` comment even inside a period, and an event before any period as a parse error. `@zombie-mermaid/svg-renderer` adds `layoutTimeline` and `renderTimelineSvg`: Mermaid's geometry for both directions, with line breaks found by summing Trebuchet MS advances. `pnpm run timeline:oracle` compares every box, wrapped line, dashed line and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0 (12.2.0 renders them identically). The ASCII output is this library's own design (Mermaid has none): a vertical spine of periods and events. Not read yet: `timeline` config in `%%{init}%%` and the `neo`/`redux` looks (see `docs/known-differences.md`).

### Patch Changes

- [#2754](https://github.com/dfadler/zombie-mermaid/pull/2754) [`60d6fbb`](https://github.com/dfadler/zombie-mermaid/commit/60d6fbb12071720d400a770bac12a903b64cf0b5) Thanks [@dfadler](https://github.com/dfadler)! - Output change: an ASCII xychart with a flat value series (every value equal, e.g. `bar [42]` or `bar [0, 0, 0]`) now draws the value axis as one tick at that value, as mermaid@12.3.0 and the SVG renderer do, instead of a `±0.1` ladder of two-decimal ticks. Fixes [#2727](https://github.com/dfadler/zombie-mermaid/issues/2727).

- [#2767](https://github.com/dfadler/zombie-mermaid/pull/2767) [`a08c1ac`](https://github.com/dfadler/zombie-mermaid/commit/a08c1ac88b3fea1b9d06bd6849a7543dd8862142) Thanks [@dfadler](https://github.com/dfadler)! - Output change: a front matter `title:` is now drawn as in Mermaid 12.3.0 ([#2585](https://github.com/dfadler/zombie-mermaid/issues/2585)). Flowchart, state, class and ER get a 54px title band above the diagram (ASCII: a centred row); sequence, pie, xychart and quadrant use it as the chart title unless the diagram has its own `title`. C4 and architecture draw nothing, as in Mermaid.

- [#2702](https://github.com/dfadler/zombie-mermaid/pull/2702) [`469eb95`](https://github.com/dfadler/zombie-mermaid/commit/469eb95712ad2eb9f627f2b8388cf356e3e5d3e7) Thanks [@dfadler](https://github.com/dfadler)! - Sequence diagrams honour `%%{init: {"sequence": {"hideUnusedParticipants": true}}}%%` like mermaid 12.3.0: participants that no message, `activate` or note names are dropped ([#2589](https://github.com/dfadler/zombie-mermaid/issues/2589)).

- [#2761](https://github.com/dfadler/zombie-mermaid/pull/2761) [`ab3796c`](https://github.com/dfadler/zombie-mermaid/commit/ab3796c4528300addaf278df35cd1fb8b6dbd9d1) Thanks [@dfadler](https://github.com/dfadler)! - Sequence `%%{init}%%` now honours `wrap`, `noteAlign`, `messageAlign` and, in SVG, `actorMargin`, `width`, `height`, `boxMargin`, `noteMargin`, `diagramMarginX/Y`, `bottomMarginAdj`, `rightAngles` and `activationWidth`, as mermaid 12.3.0 does. Font-size keys and `messageMargin` stay ignored because mermaid 12.3.0 ignores them too.

- [#2757](https://github.com/dfadler/zombie-mermaid/pull/2757) [`e4140ee`](https://github.com/dfadler/zombie-mermaid/commit/e4140ee6cca35c408581051be81532c2501a6c7f) Thanks [@dfadler](https://github.com/dfadler)! - Output change: an empty flowchart subgraph is drawn in SVG as its title only, with no frame, like mermaid@12.3.0 (a zero-height cluster). Refs [#2726](https://github.com/dfadler/zombie-mermaid/issues/2726).

## 5.14.4

### Patch Changes

- [#2626](https://github.com/dfadler/zombie-mermaid/pull/2626) [`bd2e21a`](https://github.com/dfadler/zombie-mermaid/commit/bd2e21a703aa70ba4138a6cfb88588d51fab6b1f) Thanks [@dfadler](https://github.com/dfadler)! - Output change: `architecture-beta` SVG now lays services out on Mermaid's grid instead of through ELK, so a service named by a `B`/`T`/`L`/`R` port sits exactly one cell beyond its neighbour (a replica under a junction no longer slides into the next column) and every link on the grid is one straight run. Groups are drawn as Mermaid draws them: a dashed unfilled box with the icon tile in the top-left corner and the title beside it, no header band, with Mermaid's padding. Architecture diagrams no longer need `elkjs`.

- [#2655](https://github.com/dfadler/zombie-mermaid/pull/2655) [`1f2cdeb`](https://github.com/dfadler/zombie-mermaid/commit/1f2cdeb0900be425ef5b31b6c39efd5fbb1540c8) Thanks [@dfadler](https://github.com/dfadler)! - Output change: `architecture-beta` SVG now draws edges 3px wide as Mermaid does, wraps a service label longer than 1.5 tiles onto further lines instead of overflowing, widens a group around a label that cannot wrap, takes the group border colour from the theme (`--_node-stroke`) so it follows dark mode, and ignores `curve` as Mermaid does. `MermaidSubgraph` and `PositionedGroup` gain `architecture?: boolean` (an architecture group's `icon` is now absent rather than `''`), and `MermaidEdge.acrossFlow` is marked `@deprecated`. The ELK-error message and the docs no longer list architecture among the diagrams that need `elkjs`.

- [#2675](https://github.com/dfadler/zombie-mermaid/pull/2675) [`615937d`](https://github.com/dfadler/zombie-mermaid/commit/615937d2218e1ea13f6283564c70c5e2bd8990c1) Thanks [@dfadler](https://github.com/dfadler)! - Output change: SVG state diagrams draw mermaid@12.3.0's barbed `stateDiagram-barbEnd-margin` arrowheads (the edge stops 5.5px short of the box so the tip sits 3.5px clear of it) and state boxes with a 5px corner radius instead of 6. `MermaidGraph` and `PositionedGraph` gain an optional `stateDiagram` flag. Drop shadows are not matched (visual effect, out of scope per [#2617](https://github.com/dfadler/zombie-mermaid/issues/2617)).

- [#2649](https://github.com/dfadler/zombie-mermaid/pull/2649) [`3a3c7ac`](https://github.com/dfadler/zombie-mermaid/commit/3a3c7ac0f82cd0955e2d6b736b197897da18ade9) Thanks [@dfadler](https://github.com/dfadler)! - Output change: text on a node with a custom `fill` now keeps the theme's text colour, as Mermaid 12.3.0 does, instead of being switched to black or white from the fill's brightness. A dark `style`/`classDef` fill therefore keeps dark text unless the diagram sets `color:` itself, which still wins. Applies to flowchart, state, class and ER nodes. `getReadableTextColor` stays exported from `@zombie-mermaid/core` (deprecated, unused) so the API does not break. To keep the old readability, add `color:` to the `style`/`classDef`.

- [#2653](https://github.com/dfadler/zombie-mermaid/pull/2653) [`a8a524e`](https://github.com/dfadler/zombie-mermaid/commit/a8a524e15ed347eb551a302c8c0e5daf2c9527f3) Thanks [@dfadler](https://github.com/dfadler)! - Output change: flowchart and state SVG edges are now `<path>` elements with rounded orthogonal corners (radius 5·√2 px, as mermaid 12.3.0 draws them) instead of `<polyline>`; an explicit `curve` other than `linear` is unchanged. A flowchart subgraph is drawn as mermaid 12.3.0 draws it: a centred regular-weight title along the top edge with no header band (state composites keep the band).

- [#2625](https://github.com/dfadler/zombie-mermaid/pull/2625) [`bcbe70c`](https://github.com/dfadler/zombie-mermaid/commit/bcbe70ce628cd1034b14623da6460744815e567b) Thanks [@dfadler](https://github.com/dfadler)! - Output change: ER entities are drawn as mermaid 12.3.0 draws them: a table with type, name, key and comment columns (the comment column was dropped before), lines between rows and columns, and an attribute-less entity as a taller box with the name centred. Circle (`--o`) and cross (`--x`) terminators use mermaid 12.3.0's `circleEnd-margin` / `crossEnd-margin` size.

  Output change: `mergeEdges` now defaults to `false`, so fan-out and fan-in edges each keep their own port on a node, as in mermaid 12.3.0. Pass `mergeEdges: true` for the shared trunks. Edge ends in a compound (subgraph) layout are kept on their node's face.

## 5.14.3

### Patch Changes

- [#2573](https://github.com/dfadler/zombie-mermaid/pull/2573) [`427597e`](https://github.com/dfadler/zombie-mermaid/commit/427597e23b42b10d8830c7fa52cded72c825ab3a) Thanks [@dfadler](https://github.com/dfadler)! - Architecture SVG: a `junction` is now a join with no gray disc and no gap in the edge, and a group's icon (`group api(server)[API]`) is drawn in its header, as in mermaid 12.2.0 and 12.3.0 ([#2563](https://github.com/dfadler/zombie-mermaid/issues/2563), [#2564](https://github.com/dfadler/zombie-mermaid/issues/2564)). ASCII output is unchanged.

- [#2581](https://github.com/dfadler/zombie-mermaid/pull/2581) [`47ea03c`](https://github.com/dfadler/zombie-mermaid/commit/47ea03c0b092eaac588810931aee417942f74917) Thanks [@dfadler](https://github.com/dfadler)! - Flowchart SVG: `@{ shape: }` now draws `cloud`, `h-cyl`, `tag-rect`, `sm-circ` and `fork`/`join` as Mermaid 12.3.0 does: a cloud outline, a horizontal cylinder, a dog-eared rectangle, a small unlabelled circle, and an unlabelled bar across the flow ([#2552](https://github.com/dfadler/zombie-mermaid/issues/2552)).

- [#2570](https://github.com/dfadler/zombie-mermaid/pull/2570) [`c75bab5`](https://github.com/dfadler/zombie-mermaid/commit/c75bab509c1d384cf0ee045e26ad5bcc9137a9df) Thanks [@dfadler](https://github.com/dfadler)! - Flowchart SVG: `style` and `class` on a subgraph id now fill, stroke and dash its cluster (and `color` its title), as in Mermaid 12.3.0 ([#2550](https://github.com/dfadler/zombie-mermaid/issues/2550)). A node `style` now keeps `stroke-dasharray` and, on a plain rectangle, `rx`/`ry` ([#2551](https://github.com/dfadler/zombie-mermaid/issues/2551)). The `@{ shape: }` names still drawn as approximations are listed in docs/diagrams.md ([#2552](https://github.com/dfadler/zombie-mermaid/issues/2552)).

- [#2597](https://github.com/dfadler/zombie-mermaid/pull/2597) [`8757f5d`](https://github.com/dfadler/zombie-mermaid/commit/8757f5d24cace494346cb15b40f3047114f1d2d1) Thanks [@dfadler](https://github.com/dfadler)! - A leading YAML front matter block (`---` ... `---`) is now accepted on every diagram type instead of failing with "Invalid mermaid header". `config:` is applied like the equivalent `%%{init}%%` directive; `title:` and other keys are ignored. An unterminated block reports the line of its opening `---` ([#2585](https://github.com/dfadler/zombie-mermaid/issues/2585)).

- [#2600](https://github.com/dfadler/zombie-mermaid/pull/2600) [`c387226`](https://github.com/dfadler/zombie-mermaid/commit/c38722658c4347f4ea56e8d5694373c6bd0f28ea) Thanks [@dfadler](https://github.com/dfadler)! - Sequence diagrams now honour `%%{init: {"sequence": {"mirrorActors": false}}}%%` (no participant row under the lifelines) and `showSequenceNumbers: true` (numbers messages like `autonumber`), as mermaid does. The other sequence init options and `link`/`links` are still ignored and are listed in docs/known-differences.md ([#2589](https://github.com/dfadler/zombie-mermaid/issues/2589)).

## 5.14.2

### Patch Changes

- [#2520](https://github.com/dfadler/zombie-mermaid/pull/2520) [`3671791`](https://github.com/dfadler/zombie-mermaid/commit/3671791ca95b26bc509888baa900daf1f94a7309) Thanks [@dfadler](https://github.com/dfadler)! - SVG architecture diagrams now draw each service as Mermaid does: an 80px blue icon tile with a white glyph for the built-in `database`, `disk`, `server`, `cloud`, `internet` and `blank` icons, a `?` tile for an icon name Mermaid does not know, and a dashed empty box for a service with no icon, with the label under the tile. Custom icon packs such as `logos:aws` still show the `?` tile. ASCII output is unchanged ([#2518](https://github.com/dfadler/zombie-mermaid/issues/2518)).

- [#2511](https://github.com/dfadler/zombie-mermaid/pull/2511) [`bb958a3`](https://github.com/dfadler/zombie-mermaid/commit/bb958a3ed81de0abefd4e3fcc8b1e64bd9af27d8) Thanks [@dfadler](https://github.com/dfadler)! - SVG architecture diagrams now keep services that are not in a group where their ports put them, as Mermaid does: `a:R -- L:b` neighbours share a row, and `a:B -- T:b` puts `b` straight under `a`. Previously the layered layout staggered side-linked services and laid top/bottom links out along the flow. Against mermaid 12.2.0, the Services And Edge Sides sample goes from 81% to 100% vertical and horizontal placement agreement. Services inside groups are unchanged ([#2473](https://github.com/dfadler/zombie-mermaid/issues/2473)).

- [#2522](https://github.com/dfadler/zombie-mermaid/pull/2522) [`df677f5`](https://github.com/dfadler/zombie-mermaid/commit/df677f5e0a63f4885562ca7dad8b5b743881e2ea) Thanks [@dfadler](https://github.com/dfadler)! - SVG xychart bars now follow mermaid 12.2.0's band formula, so their width and gap match mermaid with few and many categories instead of a fixed 40 px cap; `pnpm run xychart:oracle` scores bar width too.

## 5.14.1

## 5.14.0

### Minor Changes

- [#2463](https://github.com/dfadler/zombie-mermaid/pull/2463) [`91bc6cf`](https://github.com/dfadler/zombie-mermaid/commit/91bc6cf917e65fd9b38e89c0ad3a01ceccbd4d51) Thanks [@dfadler](https://github.com/dfadler)! - `quadrantChart` now reads its `%%{init}%%` config and theme variables ([#2438](https://github.com/dfadler/zombie-mermaid/issues/2438)). The `quadrantChart` block (`chartWidth`, `chartHeight`, `titleFontSize`, the paddings and label font sizes, `pointRadius`, `xAxisPosition`, `yAxisPosition`, the border stroke widths) sizes and lays out the SVG as in Mermaid 12.2.0; a bad or negative number or an unknown position is ignored. The `quadrant*Fill`, `quadrant*TextFill`, `quadrantPoint*`, axis-text, title and border stroke variables colour the SVG under any theme when `honorThemeVariables` is set. ASCII output is unchanged. `InitConfig` gains `quadrant`, `ThemeVariables` gains `quadrant`, and `QuadrantChart` gains `config` and `themeColors`. The demo pages for the type are not part of this change.

## 5.13.0

### Minor Changes

- [#2436](https://github.com/dfadler/zombie-mermaid/pull/2436) [`5eaccb9`](https://github.com/dfadler/zombie-mermaid/commit/5eaccb94bc869e7ec6715bc50f805b5d0dac6862) Thanks [@dfadler](https://github.com/dfadler)! - Quadrant charts. `quadrantChart` diagrams now parse and render to SVG and ASCII/Unicode text, the first type added under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'quadrant'` and `detectDiagramType` routes a `quadrantChart` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseQuadrantChart` with the `QuadrantChart` and `Positioned*` types: `title`, one- or two-sided `x-axis` / `y-axis`, `quadrant-1` to `quadrant-4`, `label: [x, y]` points (coordinates `0`, `1` or `0.<digits>`, as in Mermaid's grammar), `classDef` and `:::class`, the four point styles with Mermaid's validation messages, and `accTitle` / `accDescr`. The SVG uses Mermaid's 500 x 500 geometry, checked against mermaid 12.2.0, and the theme's colour variables; points without a colour are drawn in the foreground colour because Mermaid 12.2.0's default theme emits an invalid `hsl(240, 100%, NaN%)` fill there. The ASCII output is this library's own design (Mermaid has none): a four-cell grid with numbered point markers and a legend. Not read yet: `quadrantChart` config in `%%{init}%%` and the quadrant theme variables; there is no layout oracle for this type yet, so support is partial in that respect (see `docs/known-differences.md`).

## 5.12.0

## 5.11.3

### Patch Changes

- [#2400](https://github.com/dfadler/zombie-mermaid/pull/2400) [`5ca6d42`](https://github.com/dfadler/zombie-mermaid/commit/5ca6d42abc5fbeb90bd42d19cdf025798b53f40f) Thanks [@dfadler](https://github.com/dfadler)! - SVG output now honors `prefers-contrast: more` (faint derived strokes and secondary text go to full foreground) and `forced-colors: active` (they use `CanvasText`). In an SVG loaded as `<img>` only `forced-colors` applies; `prefers-contrast` does not match there ([#1878](https://github.com/dfadler/zombie-mermaid/issues/1878)).

## 5.11.2

## 5.11.1

## 5.11.0

## 5.10.2

## 5.10.1

## 5.10.0

## 5.9.1

## 5.9.0

### Minor Changes

- [#2286](https://github.com/dfadler/zombie-mermaid/pull/2286) [`382449d`](https://github.com/dfadler/zombie-mermaid/commit/382449d62597fbfcf99640d0d066d6833f2897f3) Thanks [@dfadler](https://github.com/dfadler)! - Add an opt-in `embedFont: 'subset'` render option that inlines a base64 Inter subset (Basic Latin, weights 400-700, about 14.7 KB per SVG) instead of the Google Fonts `@import`, so the font also loads when the SVG is used as an `<img>`. Output is unchanged by default. The font data is a lazily loaded chunk, not part of the default bundle: `renderMermaidSVGAsync()` loads it, and the sync `renderMermaidSVG()` needs `await loadEmbeddedFont()` (new export) first. Takes effect only with `font: 'Inter'` (the default). ([#1867](https://github.com/dfadler/zombie-mermaid/issues/1867))

## 5.8.4

## 5.8.3

## 5.8.2

### Patch Changes

- [#2244](https://github.com/dfadler/zombie-mermaid/pull/2244) [`629429c`](https://github.com/dfadler/zombie-mermaid/commit/629429ccf35213bf58df4826a9da7b8aa26414ec) Thanks [@dfadler](https://github.com/dfadler)! - Ship each package's type declarations once instead of twice. The rolled-up declaration now lives in `dist/shared/`, and `dist/*.d.ts` and `dist/*.d.cts` are one-line re-exports of it, so install size drops by about 62 KB packed. The `exports` map and the types your editor sees are unchanged, and `node16`, `nodenext` and `bundler` consumers still resolve them with `skipLibCheck` off. ([#2196](https://github.com/dfadler/zombie-mermaid/issues/2196))

- [#2248](https://github.com/dfadler/zombie-mermaid/pull/2248) [`35adab7`](https://github.com/dfadler/zombie-mermaid/commit/35adab7b60034b639db9f207a1f7139b026a1b7c) Thanks [@dfadler](https://github.com/dfadler)! - Export `resetSvgIdCounters()` so callers rendering many diagrams in one process can make the generated `zm-title-N` / `zm-desc-N` SVG ids reproducible per batch. Output is unchanged for a fresh process.

## 5.8.1

### Patch Changes

- [#2227](https://github.com/dfadler/zombie-mermaid/pull/2227) [`611736e`](https://github.com/dfadler/zombie-mermaid/commit/611736e43dc3371525f7d0a6573e74495f5b30d2) Thanks [@dfadler](https://github.com/dfadler)! - Add npm keywords and a "maintained continuation of beautiful-mermaid" line to each published sub-package's description so they are findable on npm.

## 5.8.0

### Minor Changes

- [#2172](https://github.com/dfadler/zombie-mermaid/pull/2172) [`423ce40`](https://github.com/dfadler/zombie-mermaid/commit/423ce401a2f9ffaad3ecfdb3241e0615d2c9bc1c) Thanks [@dfadler](https://github.com/dfadler)! - New opt-in render option `honorThemeVariables` (`RenderOptions` and `AsciiRenderOptions`, default `false`) that applies a small subset of a diagram's own `%%{init: {"themeVariables": {...}}}%%`: `primaryColor` (node fill, `surface`), `primaryBorderColor` (`border`) and `primaryTextColor` (`fg`) under `theme: "base"`, `lineColor` (`line`; flowchart under any theme, state diagram under `base`), and `pie1`..`pie12` (pie slices and legend, any theme). A colour you pass yourself always wins over the diagram's, invalid or unsafe values are ignored rather than thrown, and every other `themeVariables` key is reported in `InitConfig.ignored` as `themeVariables.<name>` instead of vanishing silently. Mermaid's derived colours (secondary/tertiary, the `base` border gradient, the other pie slices) are not computed. ASCII maps `lineColor`, `primaryBorderColor`, `primaryTextColor` and the pie colours, hex values only; `primaryColor` has no ASCII meaning. Checked against mermaid 12.1.0 and 12.2.0. With the option off, output is byte-identical (checked by hashing every gallery sample and ASCII testdata input, SVG and ASCII, before and after). New exports: `applyThemeVariables()` and the `ThemeVariables` type in `@zombie-mermaid/core`, `PieChart.sliceColors` in `@zombie-mermaid/mermaid-parser`. Closes [#2108](https://github.com/dfadler/zombie-mermaid/issues/2108).

  Level: minor. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, a new opt-in option is a minor change; nothing existing changes behaviour.

### Patch Changes

- [#2205](https://github.com/dfadler/zombie-mermaid/pull/2205) [`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53) Thanks [@dfadler](https://github.com/dfadler)! - Package ESM output (`dist/index.js`) is now minified: tabs, newlines and comments are removed, and `@zombie-mermaid/mcp` gets identifier mangling too. About 20.7 KB less gzip across the five packages. Behavior and exports are unchanged; stack traces from the ESM build are harder to read, and the `/* @__PURE__ */` annotations are no longer in the shipped ESM (a one-export consumer bundle was the same size). Refs [#2198](https://github.com/dfadler/zombie-mermaid/issues/2198).

- [#2200](https://github.com/dfadler/zombie-mermaid/pull/2200) [`2ef78c5`](https://github.com/dfadler/zombie-mermaid/commit/2ef78c5d4fd07e3aa486929a5037a1bbf77b0cfb) Thanks [@dfadler](https://github.com/dfadler)! - The published tarballs no longer contain `*.map` files, and the built `.js`/`.cjs` no longer end with a `//# sourceMappingURL=` comment (so a bundler does not warn about a missing map). The maps had no `sourcesContent` and pointed at `../src/*.ts` files that are not in the tarball, so no debugger could use them; they were 46% of the unpacked bytes (1,261,680 of 2,761,290 B across the six packages), and the packed size across the six drops from 751,731 B to 464,791 B. Runtime JS (apart from that comment), types, SVG and ASCII output are unchanged. Refs [#2195](https://github.com/dfadler/zombie-mermaid/issues/2195).

  Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, source maps are tarball contents nobody can import through `exports`, so removing them is not breaking; no API, option or output changes.

## 5.7.1

### Patch Changes

- [#2148](https://github.com/dfadler/zombie-mermaid/pull/2148) [`b55b7fa`](https://github.com/dfadler/zombie-mermaid/commit/b55b7fae2b576173e6b438094d21238119947ace) Thanks [@dfadler](https://github.com/dfadler)! - Output change: ASCII flowcharts now order sibling subgraphs and orient feedback edges the way mermaid 12 and the SVG renderer do ([#2111](https://github.com/dfadler/zombie-mermaid/issues/2111)). Sibling subgraphs tied by an edge or a shared outside node keep declaration order (Nested Subgraphs lists US East before US West), and an edge that closes a cycle through a subgraph boundary is ranked as running the other way (CI/CD puts `Fix & Retry` beside `Build Image`). Titles of frames pushed back to their natural width are rechecked against entering edges. The SVG back-edge helpers moved to `@zombie-mermaid/core` so both renderers share them. Patch, not minor: a layout fix with no documented output contract involved (versioning policy, section 1, "Output changes").

## 5.7.0

### Minor Changes

- [#2126](https://github.com/dfadler/zombie-mermaid/pull/2126) [`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903) Thanks [@dfadler](https://github.com/dfadler)! - Class diagrams: the parser now accepts syntax mermaid.js accepts and it used to reject with an error: the `classDiagram-v2` header (an alias of `classDiagram`), `<|--|>` / `<|..|>` / `<-->` / `<..>` / `*--*` / `o--o` (the marker is drawn at both ends, in SVG and ASCII), lollipop interfaces `()--`, `--()` and `()--()` (a hollow circle at the end of the line: `○`, or `O` with `useAscii`), and backtick-quoted class names such as `` class `Animal Class!` `` (the backticks are not drawn). Nothing that parsed before is rejected, and no existing input renders differently except the output change below; the arrow regex is built from one table, so the error for a malformed relationship now lists the longer arrow set. `ClassRelationship.markerAt` gains `'both'` and `RelationshipType` gains `'lollipop'`. Parity checked against mermaid 12.1.0 (the pin) and 12.2.0.

  Output change: in ASCII, a directional arrowhead at the `from` end of a relationship (`A <-- B`, `A <.. B`) now points into the `from` box (`▲` under it) instead of away from it (`▼`). Fixes [#2117](https://github.com/dfadler/zombie-mermaid/issues/2117).

## 5.6.1

## 5.6.0

## 5.5.0

## 5.4.0

### Minor Changes

- [#2048](https://github.com/dfadler/zombie-mermaid/pull/2048) [`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d) Thanks [@dfadler](https://github.com/dfadler)! - Support Mermaid's `accTitle:` / `accDescr:` (single-line and `accDescr { ... }`) on every diagram type, not just pie. In SVG, `accTitle` names the root (the `title` option still wins) and `accDescr` becomes `<desc>` with `aria-describedby`; both go through the one `svgOpenTag()`. ASCII output ignores the statements and is byte-identical. New `extractAccessibility()` in `@zombie-mermaid/core`.

### Patch Changes

- [#2013](https://github.com/dfadler/zombie-mermaid/pull/2013) [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8) Thanks [@dfadler](https://github.com/dfadler)! - Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in [#1596](https://github.com/dfadler/zombie-mermaid/issues/1596)) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).

- [#2017](https://github.com/dfadler/zombie-mermaid/pull/2017) [`38e2b3c`](https://github.com/dfadler/zombie-mermaid/commit/38e2b3c00efe238bb9afe8683f6758a6f23a0996) Thanks [@dfadler](https://github.com/dfadler)! - a11y: zinc-light and zinc-dark (and the default render) now set an explicit `muted` color so secondary and muted text meet WCAG 1.4.3 (4.5:1); the ER "(no attributes)" placeholder uses the muted token ([#2000](https://github.com/dfadler/zombie-mermaid/issues/2000))

## 5.3.0

### Minor Changes

- [#1984](https://github.com/dfadler/zombie-mermaid/pull/1984) [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a) Thanks [@dfadler](https://github.com/dfadler)! - Add `limits` to `renderMermaidSVG` and `renderMermaidASCII`: `maxInputLength`, `maxNodes`, `maxEdges` (and `maxCanvasCells` for ASCII) are checked before layout and throw `LimitExceededError` (`code: 'LIMIT_EXCEEDED'`). Defaults are 100,000 characters, 400 nodes, 600 edges and 2,000,000 canvas cells, so a flowchart above 400 nodes or 600 edges now throws unless you raise the limit (`Infinity` disables one). The MCP render tools use tighter limits (50,000 / 150 / 300 / 1,000,000). See the API reference.

- [#1967](https://github.com/dfadler/zombie-mermaid/pull/1967) [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5) Thanks [@dfadler](https://github.com/dfadler)! - Add `MermaidParseError` (`line`, `column`, `diagramType`, `code`, all optional) to `@zombie-mermaid/core`. Line-prefixed parser errors now throw it with the message unchanged, and the MCP parse diagnostics read `line` from it before falling back to the `Line N:` message prefix. Closes [#1855](https://github.com/dfadler/zombie-mermaid/issues/1855).

### Patch Changes

- [#1968](https://github.com/dfadler/zombie-mermaid/pull/1968) [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce) Thanks [@dfadler](https://github.com/dfadler)! - Source maps no longer embed `sourcesContent`, cutting the shipped `.map` files by about 70% (svg-renderer 1532K to 404K, ascii-renderer 2384K to 556K on disk). Stack traces keep their line numbers. Refs [#1871](https://github.com/dfadler/zombie-mermaid/issues/1871).

- [#1977](https://github.com/dfadler/zombie-mermaid/pull/1977) [`5e4a9a7`](https://github.com/dfadler/zombie-mermaid/commit/5e4a9a71b2f07c8eceaed50dc764504525065675) Thanks [@dfadler](https://github.com/dfadler)! - Retune built-in theme `muted`, `line` and `solarized-light` `fg` colors so every theme meets WCAG AA (4.5:1 for text, 3:1 for edge strokes and arrowheads). Lightness-only changes; hues are preserved.

## 5.2.0

### Minor Changes

- [#1930](https://github.com/dfadler/zombie-mermaid/pull/1930) [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9) Thanks [@dfadler](https://github.com/dfadler)! - Output change: pie charts now honour `%%{init: {"pie": {"legendPosition": ...}}}%%` and `highlightSlice` in SVG, as Mermaid 12.1.0 does. `legendPosition` takes `right` (the default, unchanged), `left`, `top`, `bottom` or `center`: left and top shift the pie to make room, top and bottom make the frame taller, and center draws the legend over the pie. An unknown value draws the default. `highlightSlice: "<label>"` draws the slice with that exact label 5% larger and fully opaque; `hover` has no meaning in a static image and is ignored. Charts that set neither option are byte-identical, and the ASCII output ignores both. Closes [#1725](https://github.com/dfadler/zombie-mermaid/issues/1725) and [#1726](https://github.com/dfadler/zombie-mermaid/issues/1726).

- [#1931](https://github.com/dfadler/zombie-mermaid/pull/1931) [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef) Thanks [@dfadler](https://github.com/dfadler)! - New option `layout: 'simple'` on `renderMermaidSVG` and the flowchart layout functions: a small built-in layered layout (longest-path ranks, barycenter crossing reduction, least-squares coordinates) that lays flowcharts out without `elkjs`, so SVG flowcharts work in a size-sensitive browser bundle. It adds about 3.5 KB gzipped. It is opt-in and never an automatic fallback: **default output is unchanged** (unset and `layout: 'elk'` are byte-identical to before). Flowcharts only; state, class, ER and architecture diagrams ignore it and still need `elkjs`. It ignores `mergeEdges`, `layoutCache` and a subgraph's own `direction`. Placement agreement with mermaid 12.1.0 on the flowchart samples is within 1 point of ELK's (see `docs/decisions/simple-layout-1685.md`). `pnpm run layout:oracle -- --layout=simple` scores it. Refs [#1685](https://github.com/dfadler/zombie-mermaid/issues/1685).

### Patch Changes

- [#1922](https://github.com/dfadler/zombie-mermaid/pull/1922) [`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1) Thanks [@dfadler](https://github.com/dfadler)! - Output change: an invalid `fill`, `stroke` or `color` value in a flowchart, state or class diagram `style`, `classDef` or `linkStyle` (`fill:notacolor`, `fill:rgb(x)`, `stroke:[#12345](https://github.com/dfadler/zombie-mermaid/issues/12345)`) is now ignored, as Mermaid does, instead of being written into the SVG as `fill="notacolor"`, which browsers paint as a black node, no border or no link line. Only the bad declaration is dropped; the other declarations in the same rule and the theme paint stay. Valid CSS colours (hex, named, `rgb()`, `hsl()`, `oklch()`, `color()`, `var()`, `color-mix()`, `none`, `transparent`, `currentColor`) are unchanged, and ASCII output is unchanged. State `classDef` is covered as well: it started painting a bad colour when state styling was added in 3.2.0. Fixes [#1918](https://github.com/dfadler/zombie-mermaid/issues/1918).

- [#1928](https://github.com/dfadler/zombie-mermaid/pull/1928) [`ebdd12f`](https://github.com/dfadler/zombie-mermaid/commit/ebdd12f58f7379dddfa9c93541543349bba5612a) Thanks [@dfadler](https://github.com/dfadler)! - Output change: `style`, `classDef` and `linkStyle` values now keep commas inside `(...)` and quotes, so `style A fill:rgb(255,0,0)`, `stroke:hsl(0,100%,50%)`, `stroke:rgba(0,0,0,.5)` and `fill:color-mix(in srgb, red 50%, blue)` paint the colour instead of losing it. Mermaid 12.1.0 itself rejects these in flowcharts and drops them in state and class diagrams, so this is a superset. Declarations without such commas parse as before, and ASCII output is unchanged. Fixes [#1921](https://github.com/dfadler/zombie-mermaid/issues/1921).

## 5.1.0

### Patch Changes

- [#1620](https://github.com/dfadler/zombie-mermaid/pull/1620) [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931) Thanks [@dfadler](https://github.com/dfadler)! - Fix package README inaccuracies and add missing `package.json` metadata ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).

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
