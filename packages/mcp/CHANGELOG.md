# @zombie-mermaid/mcp

## 5.16.0

### Patch Changes

- [#2960](https://github.com/dfadler/zombie-mermaid/pull/2960) [`e7d7d2c`](https://github.com/dfadler/zombie-mermaid/commit/e7d7d2cccb5329adabe73dd3adae735f8ade01fd) Thanks [@dfadler](https://github.com/dfadler)! - Git graphs. `gitGraph` diagrams (`gitGraph`, `gitGraph LR:`, `TB:` and `BT:`) now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2808](https://github.com/dfadler/zombie-mermaid/issues/2808)). `DiagramType` gains `'gitgraph'` and `detectDiagramType` routes a `gitGraph` header to it (case-sensitively, as Mermaid's detector does); `extractInitConfig` reads the `gitGraph` block (`mainBranchName`, `mainBranchOrder`, `showCommitLabel`, `showBranches`, `rotateCommitLabel`, `parallelCommits`). `@zombie-mermaid/mermaid-parser` adds `parseGitGraph` with the `GitGraph` and `Positioned*` types, a port of Mermaid's grammar and database: `commit` (`id:`, `msg:`, `tag:`, `type:`), `branch` (`order:`), `checkout`/`switch`, `merge` and `cherry-pick`, with Mermaid's error messages. `@zombie-mermaid/svg-renderer` adds `layoutGitGraph` and `renderGitGraphSvg`: Mermaid's geometry, arrow routing and symbols for all three orientations. `pnpm run gitgraph:oracle` compares every branch line, arrow, commit symbol, label, tag and the drawing size with real mermaid.js and agrees on all gallery samples and a sweep of other graphs with mermaid 12.3.0 (12.2.0 scores the same). The ASCII output is this library's own design (Mermaid has none): the layout of `git log --graph`, one row per commit and one column per branch. Not read yet: the `neo`/`redux` looks and themes (see `docs/known-differences.md`).

- [#2956](https://github.com/dfadler/zombie-mermaid/pull/2956) [`e42a5a9`](https://github.com/dfadler/zombie-mermaid/commit/e42a5a9b8505ddde902111134d3d4101eeb3d9e3) Thanks [@dfadler](https://github.com/dfadler)! - User journeys. `journey` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2810](https://github.com/dfadler/zombie-mermaid/issues/2810)). `DiagramType` gains `'journey'` and `detectDiagramType` routes a `journey` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseJourney` with the `Journey` and `Positioned*` types, a port of Mermaid's lexer and database: `title`, `section`, tasks written `Name: score: Actor, Actor`, `%%` and `#` comments, `;` and a task without a score as parse errors. `@zombie-mermaid/svg-renderer` adds `layoutJourney` and `renderJourneySvg`: Mermaid 12.3.0's geometry (task columns, section bars, score faces, actor dots and legend, the arrowed axis). The ASCII output is this library's own design (Mermaid has none): sections, tasks with a face, score and actors. Not read yet: `journey` config in `%%{init}%%` (see `docs/known-differences.md`).

- [#2950](https://github.com/dfadler/zombie-mermaid/pull/2950) [`321b62c`](https://github.com/dfadler/zombie-mermaid/commit/321b62c39a27c9abe45f21b45c36c8e7c115a7d4) Thanks [@dfadler](https://github.com/dfadler)! - Kanban boards. `kanban` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2811](https://github.com/dfadler/zombie-mermaid/issues/2811)). `DiagramType` gains `'kanban'`, `detectDiagramType` routes a `kanban` header to it (case-sensitively, as Mermaid's detector does) and `kanban.sectionWidth` / `kanban.ticketBaseUrl` are read from front matter and `%%{init}%%`. `@zombie-mermaid/mermaid-parser` adds `parseKanban` with the `Kanban` and `Positioned*` types, a port of Mermaid 12.3.0's jison lexer, grammar and database: columns and cards by indentation, `id[text]`, `@{ ticket, assigned, priority, label, icon }` metadata in flow or block style, `::icon()` / `:::class` lines and Mermaid's errors ("Items without section detected", lowercase `shape`). `@zombie-mermaid/svg-renderer` adds `layoutKanban` and `renderKanbanSvg`: Mermaid's geometry (205px column pitch, 185px cards, 175px text, priority bars, ticket links), with line breaks found by summing Trebuchet MS advances and modelling Chrome's `break-spaces`, hyphen and CJK breaks. `pnpm run kanban:oracle` compares every column, card, priority bar and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0. The ASCII output is this library's own design (Mermaid has none): stacked column blocks of boxed cards. Colours follow the theme (see `docs/known-differences.md`).

- [#2955](https://github.com/dfadler/zombie-mermaid/pull/2955) [`85ef8be`](https://github.com/dfadler/zombie-mermaid/commit/85ef8beac209acfdbd19baaee6b7fdf59751579b) Thanks [@dfadler](https://github.com/dfadler)! - Packet diagrams. `packet` and `packet-beta` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2813](https://github.com/dfadler/zombie-mermaid/issues/2813)). The SVG matches `mermaid@12.3.0` element by element (bit ranges, `+N` counts, fields cut across rows, `title`, and the `rowHeight`, `bitWidth`, `bitsPerRow`, `paddingX`, `paddingY`, `showBits` and `bitOrder` config keys); the ASCII drawing is this library's own, since Mermaid has no text mode for packets. `DiagramType` gains `'packet'`.

- [#2947](https://github.com/dfadler/zombie-mermaid/pull/2947) [`7f6b099`](https://github.com/dfadler/zombie-mermaid/commit/7f6b0993ff66237a43655f8d5018c5b5762eff99) Thanks [@dfadler](https://github.com/dfadler)! - Radar charts. `radar-beta` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2814](https://github.com/dfadler/zombie-mermaid/issues/2814)). `DiagramType` gains `'radar'` and `detectDiagramType` routes a `radar-beta` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseRadar` with the `Radar` and `PositionedRadar` types, a port of Mermaid's grammar and database: `axis` and `curve` lists with `["label"]`s, values written plain or as `axis: value` entries, the `showLegend`, `ticks`, `max`, `min` and `graticule` options, and Mermaid's errors (a missing entry for an axis, a newline inside an axis list, a keyword as an axis name). `@zombie-mermaid/svg-renderer` adds `layoutRadar` and `renderRadarSvg`: Mermaid's geometry (700 x 700 frame, circle and polygon graticules, bezier curves, the legend and the title). `pnpm run radar:oracle` compares the frame, rings, spokes, labels, curves, legend and title with real mermaid.js and agrees on every gallery sample and eight edge cases with mermaid 12.3.0, and the parser agrees with Mermaid's own on 87 sources. The ASCII output is this library's own design (Mermaid has none): a group of bars per axis on a ruler. Not read yet: `radar` config in `%%{init}%%` and the `radar` theme variables (see `docs/known-differences.md`).

- [#2954](https://github.com/dfadler/zombie-mermaid/pull/2954) [`401c162`](https://github.com/dfadler/zombie-mermaid/commit/401c1625f0b1bdebb9edec520fdce9469e224bee) Thanks [@dfadler](https://github.com/dfadler)! - Sankey diagrams. `sankey-beta` (and `sankey`) diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2816](https://github.com/dfadler/zombie-mermaid/issues/2816)). `DiagramType` gains `'sankey'`, `detectDiagramType` routes the header to it, and `%%{init: {"sankey": {...}}}%%` is read for `linkColor`, `nodeAlignment`, `showValues`, `prefix`, `suffix`, `labelStyle`, `width`, `height`, `nodeWidth`, `nodePadding` and `nodeColors` (`SankeyInitConfig`). `@zombie-mermaid/mermaid-parser` adds `parseSankey` with the `Sankey` and `Positioned*` types, a port of Mermaid's CSV grammar (quoted fields, printable-ASCII names, a cycle is "circular link"). `@zombie-mermaid/svg-renderer` adds `layoutSankey` and `renderSankeySvg`: d3-sankey's layout ported to TypeScript and Mermaid's drawing, which agree with mermaid 12.3.0 to 0.01px on the sample set. The ASCII output is this library's own design (Mermaid has none): each source with a bar per outgoing flow. Not done yet: a checked-in `sankey:oracle` script and Mermaid's HTML sanitising of node names (see `docs/known-differences.md`).
- Updated dependencies [[`e3f022e`](https://github.com/dfadler/zombie-mermaid/commit/e3f022e47168c7aba785964e79b272158c31b728), [`5a698d9`](https://github.com/dfadler/zombie-mermaid/commit/5a698d91b9ffa3f2bbb1078a4e8533d896847a18), [`f492dba`](https://github.com/dfadler/zombie-mermaid/commit/f492dba9e381c987eb5a1d3cef4ed791c65e51c6), [`5d33cf6`](https://github.com/dfadler/zombie-mermaid/commit/5d33cf66bf023c56a07304a4dbd6d78528ac4e6d), [`806f196`](https://github.com/dfadler/zombie-mermaid/commit/806f1963185de1252d28b1e3f695360306638915), [`2cf6d59`](https://github.com/dfadler/zombie-mermaid/commit/2cf6d5995f87f4e131f8f7d85c549fdda17390e1), [`1fb07de`](https://github.com/dfadler/zombie-mermaid/commit/1fb07de5a3f40d41f969d187047d77f5e8878dcc), [`2d60e16`](https://github.com/dfadler/zombie-mermaid/commit/2d60e16c3edc9ae813cbb53115e78656d0dfeb9e), [`1669929`](https://github.com/dfadler/zombie-mermaid/commit/16699292b6c40d64389b0af3b245d533a3c9d062), [`f367d17`](https://github.com/dfadler/zombie-mermaid/commit/f367d1750941f59970f576a5cf09676961b04568), [`e7d7d2c`](https://github.com/dfadler/zombie-mermaid/commit/e7d7d2cccb5329adabe73dd3adae735f8ade01fd), [`c488abb`](https://github.com/dfadler/zombie-mermaid/commit/c488abbd4e228b0ec3fba06578b6836405faf3ba), [`e42a5a9`](https://github.com/dfadler/zombie-mermaid/commit/e42a5a9b8505ddde902111134d3d4101eeb3d9e3), [`e28a4ab`](https://github.com/dfadler/zombie-mermaid/commit/e28a4ab0477d230f4090ce7d6e1fdbf25679007e), [`321b62c`](https://github.com/dfadler/zombie-mermaid/commit/321b62c39a27c9abe45f21b45c36c8e7c115a7d4), [`85ef8be`](https://github.com/dfadler/zombie-mermaid/commit/85ef8beac209acfdbd19baaee6b7fdf59751579b), [`f89c807`](https://github.com/dfadler/zombie-mermaid/commit/f89c807f4ed05d985740039a12be7ac89aece6e4), [`9260605`](https://github.com/dfadler/zombie-mermaid/commit/9260605bb1b9925ab538163c18d83fa997a76f24), [`7f6b099`](https://github.com/dfadler/zombie-mermaid/commit/7f6b0993ff66237a43655f8d5018c5b5762eff99), [`ebf92ba`](https://github.com/dfadler/zombie-mermaid/commit/ebf92ba78774acbbe897a1b9b3f844fbd268e301), [`85f5358`](https://github.com/dfadler/zombie-mermaid/commit/85f5358545b0b48839f5807bf3fc28d08a1f0b00), [`fb1c36a`](https://github.com/dfadler/zombie-mermaid/commit/fb1c36a1e755e50c7f47971c0e0061e5f1648928), [`401c162`](https://github.com/dfadler/zombie-mermaid/commit/401c1625f0b1bdebb9edec520fdce9469e224bee), [`21946db`](https://github.com/dfadler/zombie-mermaid/commit/21946dbc377e7563ac3a3e42de900d1915298c61), [`350f601`](https://github.com/dfadler/zombie-mermaid/commit/350f601a97d1720569d044bc4010627b25f52207), [`e8e3670`](https://github.com/dfadler/zombie-mermaid/commit/e8e3670dac298876937f1df1440129bc65e9a7f8), [`8e59552`](https://github.com/dfadler/zombie-mermaid/commit/8e595527ed8bbfb9d1d6a3bfea95380a1e301511), [`00c9985`](https://github.com/dfadler/zombie-mermaid/commit/00c99856be807ef09dc2d8e1597c131b319e5543), [`61aeff9`](https://github.com/dfadler/zombie-mermaid/commit/61aeff995e00fff55443e416cc38dc90d67a4746), [`d5c3625`](https://github.com/dfadler/zombie-mermaid/commit/d5c362501a704a89249a3da26eb4da657fc90353)]:
  - @zombie-mermaid/svg-renderer@5.16.0
  - @zombie-mermaid/ascii-renderer@5.16.0
  - @zombie-mermaid/core@5.16.0
  - @zombie-mermaid/mermaid-parser@5.16.0

## 5.15.1

### Patch Changes

- Updated dependencies [[`5eaa786`](https://github.com/dfadler/zombie-mermaid/commit/5eaa786366045faf9bd6afaf566cf454e857d2f8), [`168bded`](https://github.com/dfadler/zombie-mermaid/commit/168bded9b0cac7127166ca7723e8d4f89f1fc599)]:
  - @zombie-mermaid/ascii-renderer@5.15.1
  - @zombie-mermaid/core@5.15.1
  - @zombie-mermaid/mermaid-parser@5.15.1
  - @zombie-mermaid/svg-renderer@5.15.1

## 5.15.0

### Patch Changes

- [#2873](https://github.com/dfadler/zombie-mermaid/pull/2873) [`6fdbf16`](https://github.com/dfadler/zombie-mermaid/commit/6fdbf16284b19b7250f2adfd0f37a7a5179cdb39) Thanks [@dfadler](https://github.com/dfadler)! - Gantt charts. `gantt` diagrams now parse and render to SVG and ASCII/Unicode text ([#2835](https://github.com/dfadler/zombie-mermaid/issues/2835), under [#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'gantt'` and `detectDiagramType` routes a `gantt` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseGantt` with the `GanttChart` and `Positioned*` types and the date helpers it is built on (`parseDayjs`, `formatDayjs`, `formatD3Time`, `timeTicks`): `dateFormat`, `axisFormat`, `tickInterval`, `excludes` / `includes`, `weekday` / `weekend`, `inclusiveEndDates`, `todayMarker`, `topAxis`, sections, the `active` / `done` / `crit` / `milestone` / `vert` tags, `after` / `until` references and durations, `click`, and the `gantt` keys of `%%{init}%%` and front matter that change what is drawn. The SVG uses Mermaid's geometry and d3 time axis, checked against mermaid 12.3.0 by the new `pnpm run gantt:oracle` (rows, bars, shaded days, ticks and labels match exactly), and the theme's colour variables. The ASCII output is this library's own design: a 60-column timeline with distinct glyphs per task state. Dates are UTC and the frame is a fixed 1200px wide; `topAxis` works here although mermaid 12.3.0 fails on that statement; see `docs/known-differences.md`.

- [#2872](https://github.com/dfadler/zombie-mermaid/pull/2872) [`bfed790`](https://github.com/dfadler/zombie-mermaid/commit/bfed79057d20e563635fc9a64cae5aba34d8172d) Thanks [@dfadler](https://github.com/dfadler)! - Mindmaps. `mindmap` diagrams now parse and render to SVG and ASCII/Unicode text ([#2840](https://github.com/dfadler/zombie-mermaid/issues/2840), under [#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'mindmap'` and `detectDiagramType` routes a `mindmap` header to it. `@zombie-mermaid/mermaid-parser` adds `parseMindmap` with the `Mindmap`, `MindmapNode` and `Positioned*` types, a port of Mermaid's jison grammar (all seven shapes, `::icon()`, `:::class`, quoted and Markdown labels, Mermaid's indentation rules and its "only one root" error). The SVG renderer draws Mermaid 12.3.0's mindmap: its node shapes and sizes, its colour sections and edge widths, and its layout, a dependency-free port of the CoSE-Bilkent force layout Mermaid runs through cytoscape (bit-identical to it for a tree). `pnpm run mindmap:oracle` checks every sample against real mermaid (12.1.0, GitHub's version, 12.2.0 and 12.3.0 render mindmaps identically): structure exactly, shapes and layout from Mermaid's own measured node sizes. Colours follow the theme and label widths use this library's font, so positions drift from Mermaid's by the text-width difference; the ASCII output is an indented tree (Mermaid has none). See `docs/known-differences.md`.

- [#2876](https://github.com/dfadler/zombie-mermaid/pull/2876) [`4b32ef5`](https://github.com/dfadler/zombie-mermaid/commit/4b32ef5899910e064be2bc17e447532e52643ace) Thanks [@dfadler](https://github.com/dfadler)! - Timelines. `timeline` and `timeline TD` diagrams now parse and render to SVG and ASCII/Unicode text, under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085), [#2845](https://github.com/dfadler/zombie-mermaid/issues/2845)). `DiagramType` gains `'timeline'` and `detectDiagramType` routes a `timeline` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseTimeline` with the `Timeline` and `Positioned*` types, a port of Mermaid's lexer and database: `title`, `section`, periods with `: event` parts and continuation lines, `%%` comments, a `#` comment even inside a period, and an event before any period as a parse error. `@zombie-mermaid/svg-renderer` adds `layoutTimeline` and `renderTimelineSvg`: Mermaid's geometry for both directions, with line breaks found by summing Trebuchet MS advances. `pnpm run timeline:oracle` compares every box, wrapped line, dashed line and the drawing size with real mermaid.js and agrees on all gallery samples with mermaid 12.3.0 (12.2.0 renders them identically). The ASCII output is this library's own design (Mermaid has none): a vertical spine of periods and events. Not read yet: `timeline` config in `%%{init}%%` and the `neo`/`redux` looks (see `docs/known-differences.md`).
- Updated dependencies [[`52a75e3`](https://github.com/dfadler/zombie-mermaid/commit/52a75e32701b110f851ec56de1a1241b4e63a037), [`634347a`](https://github.com/dfadler/zombie-mermaid/commit/634347a7c875042df68a5b97d83482580a1763a5), [`0b4ae8e`](https://github.com/dfadler/zombie-mermaid/commit/0b4ae8ef95cbb555a58fbc17b19c8b3e87112793), [`5b3dd4c`](https://github.com/dfadler/zombie-mermaid/commit/5b3dd4c792bec9e7496f1c871b7306923381d9b9), [`1aef4c5`](https://github.com/dfadler/zombie-mermaid/commit/1aef4c5dbb4a45b6e68b6a9167065d468fb248a4), [`60f0218`](https://github.com/dfadler/zombie-mermaid/commit/60f021857bd00fddf94ce5ea3bc57df5c31ab5c6), [`942337f`](https://github.com/dfadler/zombie-mermaid/commit/942337f91e31b0250a4503d34ea6512849eb25f0), [`557f31b`](https://github.com/dfadler/zombie-mermaid/commit/557f31b024dcaec290ee908b17cbc500354ffea7), [`116d560`](https://github.com/dfadler/zombie-mermaid/commit/116d560b1b928aad231468d5a6bc5d7cd70ba269), [`8918949`](https://github.com/dfadler/zombie-mermaid/commit/8918949c303ce770f144581a6a884360fa26760f), [`01c39fe`](https://github.com/dfadler/zombie-mermaid/commit/01c39fe054b57f89758a4f2dc2ee66aa2f018599), [`d4bfdbd`](https://github.com/dfadler/zombie-mermaid/commit/d4bfdbd53e7eefe9dd82c5288f5dd536e37e12d6), [`d779e3d`](https://github.com/dfadler/zombie-mermaid/commit/d779e3d1e3091e128241ce2c42b75ea201ece8a7), [`fd1aac8`](https://github.com/dfadler/zombie-mermaid/commit/fd1aac8d428fcdebf423da6176ee7da8228de904), [`fd681f1`](https://github.com/dfadler/zombie-mermaid/commit/fd681f186cb2849527c7fd6f6c527ee9b1212d23), [`b5c8509`](https://github.com/dfadler/zombie-mermaid/commit/b5c85093f706bb2d601f5033c2d713be7768db41), [`2f05f91`](https://github.com/dfadler/zombie-mermaid/commit/2f05f91708e7efd34da2242a8ab7e7fb01e99f07), [`1fb82c5`](https://github.com/dfadler/zombie-mermaid/commit/1fb82c5c070098d1d05daec460743afc666dde3b), [`18ee9d7`](https://github.com/dfadler/zombie-mermaid/commit/18ee9d757af407ca607036ab789f414335bb3b2e), [`113b6e6`](https://github.com/dfadler/zombie-mermaid/commit/113b6e6ddae73dcac444ac7e42ce39cf1be1a19d), [`469619d`](https://github.com/dfadler/zombie-mermaid/commit/469619df7feff78699d5a729ccea3c03333a5fc2), [`0b02507`](https://github.com/dfadler/zombie-mermaid/commit/0b025079795ff3facd444dc5daf10fe1c70bf2fd), [`5cda2fa`](https://github.com/dfadler/zombie-mermaid/commit/5cda2fa10e3add2c6774dafc036c1861400be15c), [`fb76e59`](https://github.com/dfadler/zombie-mermaid/commit/fb76e59915209a7a14a1a56cc5a6ed39b58d5453), [`38df6e9`](https://github.com/dfadler/zombie-mermaid/commit/38df6e9eaec89b833c6469d88ac3d2d4fb60e361), [`60d6fbb`](https://github.com/dfadler/zombie-mermaid/commit/60d6fbb12071720d400a770bac12a903b64cf0b5), [`8ab0afc`](https://github.com/dfadler/zombie-mermaid/commit/8ab0afc88baaf0e0e5ccb5773a5acefdf070f012), [`0cbb03b`](https://github.com/dfadler/zombie-mermaid/commit/0cbb03bb3f94ff464b4fa086f01e2dac85c12a23), [`07a8e00`](https://github.com/dfadler/zombie-mermaid/commit/07a8e000a1ba132c096a65a1821fdafcbb9f40d9), [`8d71ccd`](https://github.com/dfadler/zombie-mermaid/commit/8d71ccdf03577da58460c2f0cb8b26c09fc29f2f), [`a718cf6`](https://github.com/dfadler/zombie-mermaid/commit/a718cf693705ce01a8a3020d1c9ac4cbb502f9c5), [`703b154`](https://github.com/dfadler/zombie-mermaid/commit/703b154aef9231906561c2d6450739b7525ab40a), [`56e74ae`](https://github.com/dfadler/zombie-mermaid/commit/56e74aebda0cf0e703ac80117500c3bfff3e5e35), [`51d8994`](https://github.com/dfadler/zombie-mermaid/commit/51d8994a2293469f65d185880d284a03be52f491), [`dcd3b26`](https://github.com/dfadler/zombie-mermaid/commit/dcd3b260ad2b48c7743e901ca64d6c980722d688), [`d596505`](https://github.com/dfadler/zombie-mermaid/commit/d59650524fb0e63f0049e173172f6d581d143d01), [`947dc5f`](https://github.com/dfadler/zombie-mermaid/commit/947dc5fad8b6898dd3441f12badb1e7c5ca27245), [`681745d`](https://github.com/dfadler/zombie-mermaid/commit/681745d05f0cefb5ebb1f4246c11132d9453e41c), [`a711f58`](https://github.com/dfadler/zombie-mermaid/commit/a711f58fd2dccd871cb812ffddadf04ed64330b9), [`b9286ca`](https://github.com/dfadler/zombie-mermaid/commit/b9286ca4acec7ade88b5552be379cc85faf0c961), [`23f680d`](https://github.com/dfadler/zombie-mermaid/commit/23f680d5cc57a4661021229f46ec7e00b9caf7d0), [`c973f82`](https://github.com/dfadler/zombie-mermaid/commit/c973f82854cea602ac9aa29518be1115dba9aaa7), [`a08c1ac`](https://github.com/dfadler/zombie-mermaid/commit/a08c1ac88b3fea1b9d06bd6849a7543dd8862142), [`6fdbf16`](https://github.com/dfadler/zombie-mermaid/commit/6fdbf16284b19b7250f2adfd0f37a7a5179cdb39), [`2c77b71`](https://github.com/dfadler/zombie-mermaid/commit/2c77b71a240bfd6e83e8bb7b1f4d522d713ea599), [`bfed790`](https://github.com/dfadler/zombie-mermaid/commit/bfed79057d20e563635fc9a64cae5aba34d8172d), [`de9196a`](https://github.com/dfadler/zombie-mermaid/commit/de9196a64ba520295f6185bd0457c2a322c71de1), [`28b4510`](https://github.com/dfadler/zombie-mermaid/commit/28b45102a1ffa24771296f1e72d1617fd607710f), [`fe071e6`](https://github.com/dfadler/zombie-mermaid/commit/fe071e6fad9b8ec169a01a31495e62a828c38d5e), [`e152571`](https://github.com/dfadler/zombie-mermaid/commit/e1525714e54cb06411dc8f6322472cb3a581f0b4), [`d6d42c2`](https://github.com/dfadler/zombie-mermaid/commit/d6d42c28673f8ee6a8f5c1c93b529fbd60d197d9), [`826d509`](https://github.com/dfadler/zombie-mermaid/commit/826d509a3f3fae2ceb83fa2cb5ec16b92a8cef58), [`3032714`](https://github.com/dfadler/zombie-mermaid/commit/3032714c01a08d44d14fd208d43d163b314a9816), [`89f48a2`](https://github.com/dfadler/zombie-mermaid/commit/89f48a22e7acd99dfcb6c14305a62a90f27b1020), [`9ef496c`](https://github.com/dfadler/zombie-mermaid/commit/9ef496c5abb0db46c18d0ccc8760c7d330feb131), [`469eb95`](https://github.com/dfadler/zombie-mermaid/commit/469eb95712ad2eb9f627f2b8388cf356e3e5d3e7), [`ab3796c`](https://github.com/dfadler/zombie-mermaid/commit/ab3796c4528300addaf278df35cd1fb8b6dbd9d1), [`8f3e729`](https://github.com/dfadler/zombie-mermaid/commit/8f3e7296d5146567bfb3b6997500195038810222), [`e4140ee`](https://github.com/dfadler/zombie-mermaid/commit/e4140ee6cca35c408581051be81532c2501a6c7f), [`dce37d7`](https://github.com/dfadler/zombie-mermaid/commit/dce37d7623c4f1a6bbf8db80234f0c82a4bdfc34), [`e7deaa9`](https://github.com/dfadler/zombie-mermaid/commit/e7deaa9a7d389494934a2cb207a2626e3aff7a36), [`b718557`](https://github.com/dfadler/zombie-mermaid/commit/b71855778f5936817fb35189c236d151ff6e760d), [`19060af`](https://github.com/dfadler/zombie-mermaid/commit/19060af7643b8f12602a0e5a86297615a71faf38), [`4b32ef5`](https://github.com/dfadler/zombie-mermaid/commit/4b32ef5899910e064be2bc17e447532e52643ace), [`14c826d`](https://github.com/dfadler/zombie-mermaid/commit/14c826debef1ab01d77343a57be7e880e50f6bee), [`e78a677`](https://github.com/dfadler/zombie-mermaid/commit/e78a677907611e531c474750cf3de72b8d89acc2), [`14ac54e`](https://github.com/dfadler/zombie-mermaid/commit/14ac54e233749c5bfd5a9909eb7b607f7044fba1), [`e1504ed`](https://github.com/dfadler/zombie-mermaid/commit/e1504edad87ea4a95e110abae82b9716579fe860)]:
  - @zombie-mermaid/svg-renderer@5.15.0
  - @zombie-mermaid/ascii-renderer@5.15.0
  - @zombie-mermaid/mermaid-parser@5.15.0
  - @zombie-mermaid/core@5.15.0

## 5.14.4

### Patch Changes

- Updated dependencies [[`bd2e21a`](https://github.com/dfadler/zombie-mermaid/commit/bd2e21a703aa70ba4138a6cfb88588d51fab6b1f), [`1f2cdeb`](https://github.com/dfadler/zombie-mermaid/commit/1f2cdeb0900be425ef5b31b6c39efd5fbb1540c8), [`dc32d5a`](https://github.com/dfadler/zombie-mermaid/commit/dc32d5a03ff36f013a311370adfcdba0ac46c25d), [`dbc2e44`](https://github.com/dfadler/zombie-mermaid/commit/dbc2e44d29f993943abe583a715bac8fee6ee130), [`343bed4`](https://github.com/dfadler/zombie-mermaid/commit/343bed4b1f905c815579faed8f737feb43371c67), [`6742ec1`](https://github.com/dfadler/zombie-mermaid/commit/6742ec12dd4f36901fd7adc729b8394fb05cb6c1), [`05bb530`](https://github.com/dfadler/zombie-mermaid/commit/05bb530b124807e5fa274de686d305be6eb8b56c), [`aa7e1b8`](https://github.com/dfadler/zombie-mermaid/commit/aa7e1b853a3ba4fa0c802f9b009682e89ef89a52), [`4ac10b9`](https://github.com/dfadler/zombie-mermaid/commit/4ac10b9ada5373b6f0d96c117e8430db0e920481), [`4672083`](https://github.com/dfadler/zombie-mermaid/commit/4672083a2429022339634625c54e0fd405bf636f), [`2cd3569`](https://github.com/dfadler/zombie-mermaid/commit/2cd3569debb60dee47df194e65be7de5698dcdc3), [`f77c298`](https://github.com/dfadler/zombie-mermaid/commit/f77c298f9e2bdfcb70558832c91807eb985c5e15), [`d0f6a4e`](https://github.com/dfadler/zombie-mermaid/commit/d0f6a4e9062e14c210ddacc49c2a67786355cbba), [`8fca8fa`](https://github.com/dfadler/zombie-mermaid/commit/8fca8fa456b0b969adf274547158651d276499c0), [`69d756e`](https://github.com/dfadler/zombie-mermaid/commit/69d756edb612693f161e8acd1f3426e597a29401), [`79c80f7`](https://github.com/dfadler/zombie-mermaid/commit/79c80f71efc0817c4143650bb0f0ebd96ae439e7), [`615937d`](https://github.com/dfadler/zombie-mermaid/commit/615937d2218e1ea13f6283564c70c5e2bd8990c1), [`26de325`](https://github.com/dfadler/zombie-mermaid/commit/26de325e318e51f563480a791525294523881b02), [`3a3c7ac`](https://github.com/dfadler/zombie-mermaid/commit/3a3c7ac0f82cd0955e2d6b736b197897da18ade9), [`4513203`](https://github.com/dfadler/zombie-mermaid/commit/451320397bdb7cba734c0dc35676f92c1ec9594b), [`a8a524e`](https://github.com/dfadler/zombie-mermaid/commit/a8a524e15ed347eb551a302c8c0e5daf2c9527f3), [`4366ad7`](https://github.com/dfadler/zombie-mermaid/commit/4366ad71e81cff6ecbfdb320ddf472e257c0556d), [`bcbe70c`](https://github.com/dfadler/zombie-mermaid/commit/bcbe70ce628cd1034b14623da6460744815e567b), [`67fc597`](https://github.com/dfadler/zombie-mermaid/commit/67fc5975db7d19d1dcc57ec90a9e0e38cafe138e), [`95b2272`](https://github.com/dfadler/zombie-mermaid/commit/95b22727a28f627db81efbeafbaca075d0314b05), [`6f2607d`](https://github.com/dfadler/zombie-mermaid/commit/6f2607daf73d2859aa8929268bd1f3520d214435)]:
  - @zombie-mermaid/svg-renderer@5.14.4
  - @zombie-mermaid/mermaid-parser@5.14.4
  - @zombie-mermaid/core@5.14.4
  - @zombie-mermaid/ascii-renderer@5.14.4

## 5.14.3

### Patch Changes

- Updated dependencies [[`08ef003`](https://github.com/dfadler/zombie-mermaid/commit/08ef003d73adb15144aa4f8806ede0e0c34f530a), [`427597e`](https://github.com/dfadler/zombie-mermaid/commit/427597e23b42b10d8830c7fa52cded72c825ab3a), [`083ce72`](https://github.com/dfadler/zombie-mermaid/commit/083ce722e9e289b1229942808899fcd2a57b8930), [`1e019fa`](https://github.com/dfadler/zombie-mermaid/commit/1e019fa12439aa207b056d049c7959bba96f9617), [`88fda60`](https://github.com/dfadler/zombie-mermaid/commit/88fda60354f16a5a730d03d3ec9260fbf0ee8c0b), [`3e1e9f8`](https://github.com/dfadler/zombie-mermaid/commit/3e1e9f8e3f65768c7176b677d003700fb77a69ff), [`e00ffd6`](https://github.com/dfadler/zombie-mermaid/commit/e00ffd69c481276c051687ecd6d8eb4fc07bb80c), [`c4137f7`](https://github.com/dfadler/zombie-mermaid/commit/c4137f7db30f404bed796d50b5dfb2dbc4ce108e), [`47ea03c`](https://github.com/dfadler/zombie-mermaid/commit/47ea03c0b092eaac588810931aee417942f74917), [`c75bab5`](https://github.com/dfadler/zombie-mermaid/commit/c75bab509c1d384cf0ee045e26ad5bcc9137a9df), [`8757f5d`](https://github.com/dfadler/zombie-mermaid/commit/8757f5d24cace494346cb15b40f3047114f1d2d1), [`c387226`](https://github.com/dfadler/zombie-mermaid/commit/c38722658c4347f4ea56e8d5694373c6bd0f28ea), [`485fdd4`](https://github.com/dfadler/zombie-mermaid/commit/485fdd40bde3ece362d27ef3290912360efa5462), [`0198234`](https://github.com/dfadler/zombie-mermaid/commit/01982344cd2a31a76f1c6b5e08eb573a1e4e6d70), [`9791be1`](https://github.com/dfadler/zombie-mermaid/commit/9791be181bbfb26dee3a08c80af27ef9d6744d3f), [`ed96f8d`](https://github.com/dfadler/zombie-mermaid/commit/ed96f8d00a43fef1d7d4e0654293b66b1866f02b), [`14e73ec`](https://github.com/dfadler/zombie-mermaid/commit/14e73ecb377660a67acfdb46dfb7bab57b55bff7), [`9d60652`](https://github.com/dfadler/zombie-mermaid/commit/9d60652938ec1342bdbf6cfe0f18e302132c901f)]:
  - @zombie-mermaid/svg-renderer@5.14.3
  - @zombie-mermaid/mermaid-parser@5.14.3
  - @zombie-mermaid/core@5.14.3
  - @zombie-mermaid/ascii-renderer@5.14.3

## 5.14.2

### Patch Changes

- Updated dependencies [[`fab7886`](https://github.com/dfadler/zombie-mermaid/commit/fab7886ca83e4c4476fd92eecf8360c9868eb750), [`3671791`](https://github.com/dfadler/zombie-mermaid/commit/3671791ca95b26bc509888baa900daf1f94a7309), [`bb958a3`](https://github.com/dfadler/zombie-mermaid/commit/bb958a3ed81de0abefd4e3fcc8b1e64bd9af27d8), [`d725006`](https://github.com/dfadler/zombie-mermaid/commit/d725006c3c46b58078b9ebe12962730961411aa5), [`35d1f0a`](https://github.com/dfadler/zombie-mermaid/commit/35d1f0a6be0f4c8be8ecafec49882eb5a7dbe199), [`ee1a26d`](https://github.com/dfadler/zombie-mermaid/commit/ee1a26db8994f916e41cc11bb6f5cca0f71d8e8c), [`1941517`](https://github.com/dfadler/zombie-mermaid/commit/1941517fdc686b8700126b4e33f814764b0c3e91), [`df677f5`](https://github.com/dfadler/zombie-mermaid/commit/df677f5e0a63f4885562ca7dad8b5b743881e2ea)]:
  - @zombie-mermaid/svg-renderer@5.14.2
  - @zombie-mermaid/core@5.14.2
  - @zombie-mermaid/mermaid-parser@5.14.2
  - @zombie-mermaid/ascii-renderer@5.14.2

## 5.14.1

### Patch Changes

- Updated dependencies [[`13617eb`](https://github.com/dfadler/zombie-mermaid/commit/13617eb067df154e257a7fba42039523b47fb7b8), [`bad44f4`](https://github.com/dfadler/zombie-mermaid/commit/bad44f4e106be390a78a91080c540f289b960d15)]:
  - @zombie-mermaid/ascii-renderer@5.14.1
  - @zombie-mermaid/mermaid-parser@5.14.1
  - @zombie-mermaid/svg-renderer@5.14.1
  - @zombie-mermaid/core@5.14.1

## 5.14.0

### Patch Changes

- Updated dependencies [[`b918077`](https://github.com/dfadler/zombie-mermaid/commit/b9180775816e55e81fcea6d6823fa5ec2dcfa856), [`96abf55`](https://github.com/dfadler/zombie-mermaid/commit/96abf5540701843be4397ab34cc3049a4fe82459), [`91bc6cf`](https://github.com/dfadler/zombie-mermaid/commit/91bc6cf917e65fd9b38e89c0ad3a01ceccbd4d51), [`8a8463d`](https://github.com/dfadler/zombie-mermaid/commit/8a8463da1b5de205525258c203b4dc5aadae568a)]:
  - @zombie-mermaid/ascii-renderer@5.14.0
  - @zombie-mermaid/svg-renderer@5.14.0
  - @zombie-mermaid/core@5.14.0
  - @zombie-mermaid/mermaid-parser@5.14.0

## 5.13.0

### Patch Changes

- [#2436](https://github.com/dfadler/zombie-mermaid/pull/2436) [`5eaccb9`](https://github.com/dfadler/zombie-mermaid/commit/5eaccb94bc869e7ec6715bc50f805b5d0dac6862) Thanks [@dfadler](https://github.com/dfadler)! - Quadrant charts. `quadrantChart` diagrams now parse and render to SVG and ASCII/Unicode text, the first type added under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'quadrant'` and `detectDiagramType` routes a `quadrantChart` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseQuadrantChart` with the `QuadrantChart` and `Positioned*` types: `title`, one- or two-sided `x-axis` / `y-axis`, `quadrant-1` to `quadrant-4`, `label: [x, y]` points (coordinates `0`, `1` or `0.<digits>`, as in Mermaid's grammar), `classDef` and `:::class`, the four point styles with Mermaid's validation messages, and `accTitle` / `accDescr`. The SVG uses Mermaid's 500 x 500 geometry, checked against mermaid 12.2.0, and the theme's colour variables; points without a colour are drawn in the foreground colour because Mermaid 12.2.0's default theme emits an invalid `hsl(240, 100%, NaN%)` fill there. The ASCII output is this library's own design (Mermaid has none): a four-cell grid with numbered point markers and a legend. Not read yet: `quadrantChart` config in `%%{init}%%` and the quadrant theme variables; there is no layout oracle for this type yet, so support is partial in that respect (see `docs/known-differences.md`).
- Updated dependencies [[`d3eedd2`](https://github.com/dfadler/zombie-mermaid/commit/d3eedd2feda1347fc82c87a98d5c714e27351fc4), [`817885e`](https://github.com/dfadler/zombie-mermaid/commit/817885ec949b96e5e92835dc7547a4ebc5a22af3), [`5eaccb9`](https://github.com/dfadler/zombie-mermaid/commit/5eaccb94bc869e7ec6715bc50f805b5d0dac6862), [`96cd7e6`](https://github.com/dfadler/zombie-mermaid/commit/96cd7e634fc3543629b032994e2ff347faedb76b)]:
  - @zombie-mermaid/ascii-renderer@5.13.0
  - @zombie-mermaid/svg-renderer@5.13.0
  - @zombie-mermaid/core@5.13.0
  - @zombie-mermaid/mermaid-parser@5.13.0

## 5.12.0

### Patch Changes

- Updated dependencies [[`e400a43`](https://github.com/dfadler/zombie-mermaid/commit/e400a436831e2ce3362b6513d21228a3e7949b8d)]:
  - @zombie-mermaid/mermaid-parser@5.12.0
  - @zombie-mermaid/ascii-renderer@5.12.0
  - @zombie-mermaid/svg-renderer@5.12.0
  - @zombie-mermaid/core@5.12.0

## 5.11.3

### Patch Changes

- Updated dependencies [[`ca18ea9`](https://github.com/dfadler/zombie-mermaid/commit/ca18ea9bf1f420075443e74221a865aff603beb9), [`5ca6d42`](https://github.com/dfadler/zombie-mermaid/commit/5ca6d42abc5fbeb90bd42d19cdf025798b53f40f)]:
  - @zombie-mermaid/ascii-renderer@5.11.3
  - @zombie-mermaid/core@5.11.3
  - @zombie-mermaid/mermaid-parser@5.11.3
  - @zombie-mermaid/svg-renderer@5.11.3

## 5.11.2

### Patch Changes

- Updated dependencies [[`0a0e51c`](https://github.com/dfadler/zombie-mermaid/commit/0a0e51c33cdb4c902b85ec442426638034bda381), [`c5d83df`](https://github.com/dfadler/zombie-mermaid/commit/c5d83dff19a64756398704e28f9d7c449a605faa)]:
  - @zombie-mermaid/ascii-renderer@5.11.2
  - @zombie-mermaid/core@5.11.2
  - @zombie-mermaid/mermaid-parser@5.11.2
  - @zombie-mermaid/svg-renderer@5.11.2

## 5.11.1

### Patch Changes

- Updated dependencies [[`3d5e2a3`](https://github.com/dfadler/zombie-mermaid/commit/3d5e2a3232cef4ad8c51d2c609d538511b45efd4)]:
  - @zombie-mermaid/ascii-renderer@5.11.1
  - @zombie-mermaid/core@5.11.1
  - @zombie-mermaid/mermaid-parser@5.11.1
  - @zombie-mermaid/svg-renderer@5.11.1

## 5.11.0

### Patch Changes

- [#2355](https://github.com/dfadler/zombie-mermaid/pull/2355) [`ed2ad94`](https://github.com/dfadler/zombie-mermaid/commit/ed2ad9468b465565c93367c054f83381b5f44487) Thanks [@dfadler](https://github.com/dfadler)! - `validate_mermaid` diagnostics now carry an optional stable `code` (`EMPTY_DIAGRAM`, the generic `PARSE_ERROR`, or a code the error carries such as `LIMIT_EXCEEDED`) so agents can branch on it.
- Updated dependencies [[`82674ef`](https://github.com/dfadler/zombie-mermaid/commit/82674ef11fa576022f80191dbd1537be229fac4a), [`bc452e7`](https://github.com/dfadler/zombie-mermaid/commit/bc452e762a64afa970a1762d0bb623eb7e008aa4), [`e7ade77`](https://github.com/dfadler/zombie-mermaid/commit/e7ade7773ed06814a74a2123dc1db69c7864880e), [`6b04529`](https://github.com/dfadler/zombie-mermaid/commit/6b04529b795d895a8dc1edd96e33b42b15a42d01), [`b7f6aec`](https://github.com/dfadler/zombie-mermaid/commit/b7f6aeca3921e720e1318bdf04abd895fa4e3d82), [`42f3e40`](https://github.com/dfadler/zombie-mermaid/commit/42f3e40eca7cf0253ee86fcb5ae072807cdc070d)]:
  - @zombie-mermaid/ascii-renderer@5.11.0
  - @zombie-mermaid/core@5.11.0
  - @zombie-mermaid/mermaid-parser@5.11.0
  - @zombie-mermaid/svg-renderer@5.11.0

## 5.10.2

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@5.10.2
  - @zombie-mermaid/core@5.10.2
  - @zombie-mermaid/mermaid-parser@5.10.2
  - @zombie-mermaid/svg-renderer@5.10.2

## 5.10.1

### Patch Changes

- Updated dependencies [[`0932ec7`](https://github.com/dfadler/zombie-mermaid/commit/0932ec76666fc81574607829b819fd35715b9b9e)]:
  - @zombie-mermaid/ascii-renderer@5.10.1
  - @zombie-mermaid/core@5.10.1
  - @zombie-mermaid/mermaid-parser@5.10.1
  - @zombie-mermaid/svg-renderer@5.10.1

## 5.10.0

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@5.10.0
  - @zombie-mermaid/core@5.10.0
  - @zombie-mermaid/mermaid-parser@5.10.0
  - @zombie-mermaid/svg-renderer@5.10.0

## 5.9.1

### Patch Changes

- Updated dependencies [[`0ca073f`](https://github.com/dfadler/zombie-mermaid/commit/0ca073f153a8127616e385851d994e0e7d8ed9f5), [`5817019`](https://github.com/dfadler/zombie-mermaid/commit/5817019fbb3e11d9491632abaf97f0811275462f), [`f3023c7`](https://github.com/dfadler/zombie-mermaid/commit/f3023c7ab5ec7275c3e9d49374db3dc7fd425526), [`c18cd26`](https://github.com/dfadler/zombie-mermaid/commit/c18cd2645b7aab54857df40be6ff4f43f499a168), [`a1fcbbf`](https://github.com/dfadler/zombie-mermaid/commit/a1fcbbfc1a8e13180384539ff1351e31ead163ba), [`9ed0a46`](https://github.com/dfadler/zombie-mermaid/commit/9ed0a467fd7b127d07c754500305b667c5937e3f), [`b5f9f06`](https://github.com/dfadler/zombie-mermaid/commit/b5f9f067d28019c3e88cdff67195475b6bbfefc4), [`d398e27`](https://github.com/dfadler/zombie-mermaid/commit/d398e278f2d1f63eddfb27961d262a4541691929)]:
  - @zombie-mermaid/ascii-renderer@5.9.1
  - @zombie-mermaid/svg-renderer@5.9.1
  - @zombie-mermaid/core@5.9.1
  - @zombie-mermaid/mermaid-parser@5.9.1

## 5.9.0

### Patch Changes

- Updated dependencies [[`38a4718`](https://github.com/dfadler/zombie-mermaid/commit/38a47185c0f1fc2595f9783be4ad1ee752a6882e), [`8442116`](https://github.com/dfadler/zombie-mermaid/commit/8442116a8edda4dbbe7034920d0e98a2e0720189), [`0625bdd`](https://github.com/dfadler/zombie-mermaid/commit/0625bdd73684445d741663c9888a22002399c04f), [`d4a608d`](https://github.com/dfadler/zombie-mermaid/commit/d4a608d0587d9336e4de1efe70173821ca193e23), [`959fb6f`](https://github.com/dfadler/zombie-mermaid/commit/959fb6f430546ec2f497373347c316772924a942), [`382449d`](https://github.com/dfadler/zombie-mermaid/commit/382449d62597fbfcf99640d0d066d6833f2897f3), [`0bcc115`](https://github.com/dfadler/zombie-mermaid/commit/0bcc115dd5a943627f795a111442ae08d3c62af1)]:
  - @zombie-mermaid/ascii-renderer@5.9.0
  - @zombie-mermaid/svg-renderer@5.9.0
  - @zombie-mermaid/mermaid-parser@5.9.0
  - @zombie-mermaid/core@5.9.0

## 5.8.4

### Patch Changes

- [#2277](https://github.com/dfadler/zombie-mermaid/pull/2277) [`55925f7`](https://github.com/dfadler/zombie-mermaid/commit/55925f7ba6ac635ab42607256ff9734565c1009d) Thanks [@dfadler](https://github.com/dfadler)! - Add `mcpName` to package.json so the package can be published to the official MCP Registry, and fix the tool count in the MCP package README.
- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@5.8.4
  - @zombie-mermaid/core@5.8.4
  - @zombie-mermaid/mermaid-parser@5.8.4
  - @zombie-mermaid/svg-renderer@5.8.4

## 5.8.3

### Patch Changes

- Updated dependencies [[`e217ee9`](https://github.com/dfadler/zombie-mermaid/commit/e217ee9fe9d68878402cbaa69a453e83e24733f8)]:
  - @zombie-mermaid/ascii-renderer@5.8.3
  - @zombie-mermaid/core@5.8.3
  - @zombie-mermaid/mermaid-parser@5.8.3
  - @zombie-mermaid/svg-renderer@5.8.3

## 5.8.2

### Patch Changes

- [#2244](https://github.com/dfadler/zombie-mermaid/pull/2244) [`629429c`](https://github.com/dfadler/zombie-mermaid/commit/629429ccf35213bf58df4826a9da7b8aa26414ec) Thanks [@dfadler](https://github.com/dfadler)! - Ship each package's type declarations once instead of twice. The rolled-up declaration now lives in `dist/shared/`, and `dist/*.d.ts` and `dist/*.d.cts` are one-line re-exports of it, so install size drops by about 62 KB packed. The `exports` map and the types your editor sees are unchanged, and `node16`, `nodenext` and `bundler` consumers still resolve them with `skipLibCheck` off. ([#2196](https://github.com/dfadler/zombie-mermaid/issues/2196))
- Updated dependencies [[`436c50e`](https://github.com/dfadler/zombie-mermaid/commit/436c50ede0ee847381e2eefbe2a32b9fe35e764b), [`eae88b9`](https://github.com/dfadler/zombie-mermaid/commit/eae88b98a22dd9c710540970d1447d51602b2cc9), [`629429c`](https://github.com/dfadler/zombie-mermaid/commit/629429ccf35213bf58df4826a9da7b8aa26414ec), [`35adab7`](https://github.com/dfadler/zombie-mermaid/commit/35adab7b60034b639db9f207a1f7139b026a1b7c)]:
  - @zombie-mermaid/ascii-renderer@5.8.2
  - @zombie-mermaid/mermaid-parser@5.8.2
  - @zombie-mermaid/svg-renderer@5.8.2
  - @zombie-mermaid/core@5.8.2

## 5.8.1

### Patch Changes

- [#2222](https://github.com/dfadler/zombie-mermaid/pull/2222) [`0d4348f`](https://github.com/dfadler/zombie-mermaid/commit/0d4348fe48d22f6b4983b6093deadd2a9424737d) Thanks [@dfadler](https://github.com/dfadler)! - Raise the `@modelcontextprotocol/sdk` floor to `^1.32.1` so installs pick up the patched `hono`, `proxy-addr`, `ip-address` and `fast-uri` transitive dependencies.

- [#2227](https://github.com/dfadler/zombie-mermaid/pull/2227) [`611736e`](https://github.com/dfadler/zombie-mermaid/commit/611736e43dc3371525f7d0a6573e74495f5b30d2) Thanks [@dfadler](https://github.com/dfadler)! - Add npm keywords and a "maintained continuation of beautiful-mermaid" line to each published sub-package's description so they are findable on npm.
- Updated dependencies [[`69f5734`](https://github.com/dfadler/zombie-mermaid/commit/69f5734c8190c1327d0c695e67437442c6e75b84), [`611736e`](https://github.com/dfadler/zombie-mermaid/commit/611736e43dc3371525f7d0a6573e74495f5b30d2)]:
  - @zombie-mermaid/svg-renderer@5.8.1
  - @zombie-mermaid/core@5.8.1
  - @zombie-mermaid/ascii-renderer@5.8.1
  - @zombie-mermaid/mermaid-parser@5.8.1

## 5.8.0

### Patch Changes

- [#2205](https://github.com/dfadler/zombie-mermaid/pull/2205) [`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53) Thanks [@dfadler](https://github.com/dfadler)! - Package ESM output (`dist/index.js`) is now minified: tabs, newlines and comments are removed, and `@zombie-mermaid/mcp` gets identifier mangling too. About 20.7 KB less gzip across the five packages. Behavior and exports are unchanged; stack traces from the ESM build are harder to read, and the `/* @__PURE__ */` annotations are no longer in the shipped ESM (a one-export consumer bundle was the same size). Refs [#2198](https://github.com/dfadler/zombie-mermaid/issues/2198).

- [#2200](https://github.com/dfadler/zombie-mermaid/pull/2200) [`2ef78c5`](https://github.com/dfadler/zombie-mermaid/commit/2ef78c5d4fd07e3aa486929a5037a1bbf77b0cfb) Thanks [@dfadler](https://github.com/dfadler)! - The published tarballs no longer contain `*.map` files, and the built `.js`/`.cjs` no longer end with a `//# sourceMappingURL=` comment (so a bundler does not warn about a missing map). The maps had no `sourcesContent` and pointed at `../src/*.ts` files that are not in the tarball, so no debugger could use them; they were 46% of the unpacked bytes (1,261,680 of 2,761,290 B across the six packages), and the packed size across the six drops from 751,731 B to 464,791 B. Runtime JS (apart from that comment), types, SVG and ASCII output are unchanged. Refs [#2195](https://github.com/dfadler/zombie-mermaid/issues/2195).

  Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, source maps are tarball contents nobody can import through `exports`, so removing them is not breaking; no API, option or output changes.

- Updated dependencies [[`4839c72`](https://github.com/dfadler/zombie-mermaid/commit/4839c726bc5e0a7438948e1046022eb3dc4fb267), [`e5d95aa`](https://github.com/dfadler/zombie-mermaid/commit/e5d95aa6f0cd01acc2fb2ba7f59cbfea685ecd03), [`7c23dec`](https://github.com/dfadler/zombie-mermaid/commit/7c23dec0f3d87499eaff0452a0dea520a160b4de), [`20367fc`](https://github.com/dfadler/zombie-mermaid/commit/20367fc79c05a5275487c7dc7ecbe463d19deb5b), [`2ec3f0b`](https://github.com/dfadler/zombie-mermaid/commit/2ec3f0b91990ca6fb4d8fcf6565889bd5683f9ce), [`12c90fa`](https://github.com/dfadler/zombie-mermaid/commit/12c90faaccfbb3d97359c4488212cc5cd4edb4cf), [`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53), [`a6ab920`](https://github.com/dfadler/zombie-mermaid/commit/a6ab92064dc024f80c31aa532a409c9b5ff547b5), [`2ef78c5`](https://github.com/dfadler/zombie-mermaid/commit/2ef78c5d4fd07e3aa486929a5037a1bbf77b0cfb), [`d6c1297`](https://github.com/dfadler/zombie-mermaid/commit/d6c1297b43e6acfb74c945518015dc0615e74074), [`423ce40`](https://github.com/dfadler/zombie-mermaid/commit/423ce401a2f9ffaad3ecfdb3241e0615d2c9bc1c)]:
  - @zombie-mermaid/ascii-renderer@5.8.0
  - @zombie-mermaid/svg-renderer@5.8.0
  - @zombie-mermaid/mermaid-parser@5.8.0
  - @zombie-mermaid/core@5.8.0

## 5.7.1

### Patch Changes

- Updated dependencies [[`8a8c482`](https://github.com/dfadler/zombie-mermaid/commit/8a8c482cd45570fb76c7757986236d1170b0d301), [`b55b7fa`](https://github.com/dfadler/zombie-mermaid/commit/b55b7fae2b576173e6b438094d21238119947ace), [`f5e5454`](https://github.com/dfadler/zombie-mermaid/commit/f5e5454136070993bb1552dec3616c2750a6f15f), [`d88b061`](https://github.com/dfadler/zombie-mermaid/commit/d88b0619fd0d5cd5f7e8c59abb0ad1dc2029eec1)]:
  - @zombie-mermaid/ascii-renderer@5.7.1
  - @zombie-mermaid/core@5.7.1
  - @zombie-mermaid/svg-renderer@5.7.1
  - @zombie-mermaid/mermaid-parser@5.7.1

## 5.7.0

### Patch Changes

- Updated dependencies [[`3dea4e8`](https://github.com/dfadler/zombie-mermaid/commit/3dea4e87ad6f4f3d285368ca3d460396e51e6fba), [`1629a93`](https://github.com/dfadler/zombie-mermaid/commit/1629a93b59f74df129350aa69985039f2cc70cda), [`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903), [`90e2fdc`](https://github.com/dfadler/zombie-mermaid/commit/90e2fdc0527bab025bda9126ea525c6edca06259)]:
  - @zombie-mermaid/ascii-renderer@5.7.0
  - @zombie-mermaid/core@5.7.0
  - @zombie-mermaid/mermaid-parser@5.7.0
  - @zombie-mermaid/svg-renderer@5.7.0

## 5.6.1

### Patch Changes

- Updated dependencies [[`972abd4`](https://github.com/dfadler/zombie-mermaid/commit/972abd4fa57bb73e071f04981f32cd9da7801543)]:
  - @zombie-mermaid/ascii-renderer@5.6.1
  - @zombie-mermaid/core@5.6.1
  - @zombie-mermaid/mermaid-parser@5.6.1
  - @zombie-mermaid/svg-renderer@5.6.1

## 5.6.0

### Minor Changes

- [#2095](https://github.com/dfadler/zombie-mermaid/pull/2095) [`16f3fdb`](https://github.com/dfadler/zombie-mermaid/commit/16f3fdbaee19310de884fa1a31d3b722d2ad0148) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: `render_mermaid_svg` and `render_mermaid_ascii` now render in a long-lived worker thread. A render that runs longer than 15 s, or exceeds 512 MB of heap, is stopped and returns the usual `isError` result ("render timed out ..." / "render ran out of memory ..."); the server stays responsive and the next request gets a fresh worker. Previously such a render stalled every request or killed the stdio server. Rendered output is byte-identical, and no tool name, schema or result shape changes. The package now ships `dist/render-worker.js` next to its entry files.

### Patch Changes

- Updated dependencies [[`0d940f6`](https://github.com/dfadler/zombie-mermaid/commit/0d940f68a55f6f6812c5a243c53b7f94bcb1ad39)]:
  - @zombie-mermaid/ascii-renderer@5.6.0
  - @zombie-mermaid/core@5.6.0
  - @zombie-mermaid/mermaid-parser@5.6.0
  - @zombie-mermaid/svg-renderer@5.6.0

## 5.5.0

### Patch Changes

- Updated dependencies [[`50c39dc`](https://github.com/dfadler/zombie-mermaid/commit/50c39dcbb149519e92225d464cf99e46799bed6f), [`df88acb`](https://github.com/dfadler/zombie-mermaid/commit/df88acb864e45a6876b1744385c5db863a402176), [`b8f3e39`](https://github.com/dfadler/zombie-mermaid/commit/b8f3e39e83ee256cf80b885dd6201686d3196e6a), [`ffdc68e`](https://github.com/dfadler/zombie-mermaid/commit/ffdc68e2e8a19332ea8f075ca709b0e65df67814), [`ec37506`](https://github.com/dfadler/zombie-mermaid/commit/ec3750657f88ec2466344e556b77d6f2a147319a), [`242335c`](https://github.com/dfadler/zombie-mermaid/commit/242335c43afd4d50894435c49993abf69d7f017c), [`cf53ce5`](https://github.com/dfadler/zombie-mermaid/commit/cf53ce5b38fef7d10be32edd8112904deeda89c7), [`4a29ac5`](https://github.com/dfadler/zombie-mermaid/commit/4a29ac5939409c08bf89d6fecf913cbb2719b8f2), [`0a493e2`](https://github.com/dfadler/zombie-mermaid/commit/0a493e21c78e6d259996bb2b65dbd63ae689ab3c), [`efb2ade`](https://github.com/dfadler/zombie-mermaid/commit/efb2ade09c6bfbe05b49ea5b7f3961b1d5794fb6), [`e21b993`](https://github.com/dfadler/zombie-mermaid/commit/e21b993aec9aa7b3c6f3e747aeb0e98bdf9ac08b)]:
  - @zombie-mermaid/ascii-renderer@5.5.0
  - @zombie-mermaid/svg-renderer@5.5.0
  - @zombie-mermaid/core@5.5.0
  - @zombie-mermaid/mermaid-parser@5.5.0

## 5.4.0

### Minor Changes

- [#2047](https://github.com/dfadler/zombie-mermaid/pull/2047) [`d28ff6c`](https://github.com/dfadler/zombie-mermaid/commit/d28ff6cb0005069901b65db005919b26af1c80db) Thanks [@dfadler](https://github.com/dfadler)! - Expose the ASCII `profile: 'markdown'` preset through the CLI (`render --ascii --profile markdown`) and the MCP `render_mermaid_ascii` tool (`profile`).

### Patch Changes

- [#2013](https://github.com/dfadler/zombie-mermaid/pull/2013) [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8) Thanks [@dfadler](https://github.com/dfadler)! - Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in [#1596](https://github.com/dfadler/zombie-mermaid/issues/1596)) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).
- Updated dependencies [[`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d), [`520c6b1`](https://github.com/dfadler/zombie-mermaid/commit/520c6b1ceaddbb8c3817e528b4704b88740b6ee5), [`10f4259`](https://github.com/dfadler/zombie-mermaid/commit/10f425979fca1b6150ebc1139d5fc9bf9f3971e3), [`344431e`](https://github.com/dfadler/zombie-mermaid/commit/344431ec91d52753988a6bce3b380c394a401c33), [`0f89a9d`](https://github.com/dfadler/zombie-mermaid/commit/0f89a9db354f32fa14aa55455e28be0376d284ac), [`b7314ed`](https://github.com/dfadler/zombie-mermaid/commit/b7314ed0e47b0392573b36d6863036e0a05d2b4d), [`0c2b6d3`](https://github.com/dfadler/zombie-mermaid/commit/0c2b6d3ec38fb97bcc927573b82de06fd83c9492), [`36f8c04`](https://github.com/dfadler/zombie-mermaid/commit/36f8c049eb94c3eef47c4a07a61ea7231c837d57), [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8), [`adf9f32`](https://github.com/dfadler/zombie-mermaid/commit/adf9f32494a78701c37894dfcb6c4a96344b7447), [`782eaa0`](https://github.com/dfadler/zombie-mermaid/commit/782eaa00d9e8d0a8503bc2c4039c5ab4a22467a6), [`38e2b3c`](https://github.com/dfadler/zombie-mermaid/commit/38e2b3c00efe238bb9afe8683f6758a6f23a0996)]:
  - @zombie-mermaid/core@5.4.0
  - @zombie-mermaid/svg-renderer@5.4.0
  - @zombie-mermaid/ascii-renderer@5.4.0
  - @zombie-mermaid/mermaid-parser@5.4.0

## 5.3.0

### Minor Changes

- [#1963](https://github.com/dfadler/zombie-mermaid/pull/1963) [`ea05f88`](https://github.com/dfadler/zombie-mermaid/commit/ea05f88dc9622a9414cd40c4b94842b664dedb7e) Thanks [@dfadler](https://github.com/dfadler)! - The MCP JSON tools (`validate_mermaid`, `check_mermaid_sequence_activations`, `fix_mermaid_sequence_activations`, `list_themes`, `list_diagram_types`) now declare an `outputSchema` and return matching `structuredContent`, alongside the existing JSON text block. Fixes [#1857](https://github.com/dfadler/zombie-mermaid/issues/1857).

- [#1984](https://github.com/dfadler/zombie-mermaid/pull/1984) [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a) Thanks [@dfadler](https://github.com/dfadler)! - Add `limits` to `renderMermaidSVG` and `renderMermaidASCII`: `maxInputLength`, `maxNodes`, `maxEdges` (and `maxCanvasCells` for ASCII) are checked before layout and throw `LimitExceededError` (`code: 'LIMIT_EXCEEDED'`). Defaults are 100,000 characters, 400 nodes, 600 edges and 2,000,000 canvas cells, so a flowchart above 400 nodes or 600 edges now throws unless you raise the limit (`Infinity` disables one). The MCP render tools use tighter limits (50,000 / 150 / 300 / 1,000,000). See the API reference.

### Patch Changes

- [#1967](https://github.com/dfadler/zombie-mermaid/pull/1967) [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5) Thanks [@dfadler](https://github.com/dfadler)! - Add `MermaidParseError` (`line`, `column`, `diagramType`, `code`, all optional) to `@zombie-mermaid/core`. Line-prefixed parser errors now throw it with the message unchanged, and the MCP parse diagnostics read `line` from it before falling back to the `Line N:` message prefix. Closes [#1855](https://github.com/dfadler/zombie-mermaid/issues/1855).

- [#2005](https://github.com/dfadler/zombie-mermaid/pull/2005) [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d) Thanks [@dfadler](https://github.com/dfadler)! - Every parser failure is now a `MermaidParseError` with `diagramType` set (and `line` where the parser knows it, now including C4 and architecture statement errors); the pie parser also sets `column`. Messages are unchanged. The MCP diagnostics read the typed `line` instead of parsing the message, so C4 and architecture errors now get a source-line diagnostic. `ElkNotRegisteredError` stays a plain `Error`: it is a missing-peer-dependency error, not a problem in the diagram. Closes [#1979](https://github.com/dfadler/zombie-mermaid/issues/1979).
- Updated dependencies [[`d028603`](https://github.com/dfadler/zombie-mermaid/commit/d028603dbe31376e1e1b26c05749f8719445a7a5), [`ef0f872`](https://github.com/dfadler/zombie-mermaid/commit/ef0f872d83bf76fa65cbcf1ff630700dc5470d4e), [`8daa5ee`](https://github.com/dfadler/zombie-mermaid/commit/8daa5ee7f10ac14bf161ba48e1cd54dd0155b077), [`fa02ffe`](https://github.com/dfadler/zombie-mermaid/commit/fa02ffe3ab869d1d92d87ce67d82b2e8ce4ff1f9), [`e63ed98`](https://github.com/dfadler/zombie-mermaid/commit/e63ed989d8179d428149d1f48e31e78a87f261f3), [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a), [`858a8ba`](https://github.com/dfadler/zombie-mermaid/commit/858a8ba39898b95678c300120590130835f7445d), [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce), [`5e4a9a7`](https://github.com/dfadler/zombie-mermaid/commit/5e4a9a71b2f07c8eceaed50dc764504525065675), [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5), [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d)]:
  - @zombie-mermaid/ascii-renderer@5.3.0
  - @zombie-mermaid/svg-renderer@5.3.0
  - @zombie-mermaid/core@5.3.0
  - @zombie-mermaid/mermaid-parser@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [[`fda110d`](https://github.com/dfadler/zombie-mermaid/commit/fda110dd94834fc268a8b49e3b2b0df56bd873ba), [`87336e0`](https://github.com/dfadler/zombie-mermaid/commit/87336e06a1ceb86b1695b807803962ed2a095ce2), [`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1), [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9), [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef), [`ebdd12f`](https://github.com/dfadler/zombie-mermaid/commit/ebdd12f58f7379dddfa9c93541543349bba5612a)]:
  - @zombie-mermaid/svg-renderer@5.2.0
  - @zombie-mermaid/mermaid-parser@5.2.0
  - @zombie-mermaid/ascii-renderer@5.2.0
  - @zombie-mermaid/core@5.2.0

## 5.1.0

### Minor Changes

- [#1727](https://github.com/dfadler/zombie-mermaid/pull/1727) [`ce29689`](https://github.com/dfadler/zombie-mermaid/commit/ce2968907a79cbbb0f81f50eb70ce80b4f0e2da1) Thanks [@dfadler](https://github.com/dfadler)! - Add a `validate_mermaid` MCP tool and a `zombie-mermaid validate [file]` CLI command (parse only, line diagnostics, exit 1 when invalid). Failed `render` runs now print the offending source line too. New `validateMermaid()` export.

### Patch Changes

- [#1629](https://github.com/dfadler/zombie-mermaid/pull/1629) [`192bb09`](https://github.com/dfadler/zombie-mermaid/commit/192bb093ac050c8b20feacf4daf3701d479a68e7) Thanks [@dfadler](https://github.com/dfadler)! - `render_svg` no longer leaks filesystem details in `outputPath` write errors; the MCP threat model is now documented.

- [#1620](https://github.com/dfadler/zombie-mermaid/pull/1620) [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931) Thanks [@dfadler](https://github.com/dfadler)! - Fix package README inaccuracies and add missing `package.json` metadata ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).
- Updated dependencies [[`ce29689`](https://github.com/dfadler/zombie-mermaid/commit/ce2968907a79cbbb0f81f50eb70ce80b4f0e2da1), [`7104031`](https://github.com/dfadler/zombie-mermaid/commit/71040311cdca8de5f3c3ce41c6d9a54209ed8b8f), [`3ec564e`](https://github.com/dfadler/zombie-mermaid/commit/3ec564ea51616fceb6facb37709313e15fb8b7d6), [`fd1367f`](https://github.com/dfadler/zombie-mermaid/commit/fd1367fda8a8d7759e3883af1fada45e282a0903), [`0d6711c`](https://github.com/dfadler/zombie-mermaid/commit/0d6711c1c51a57e25ede4c11e360c208ea4b9278), [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931)]:
  - @zombie-mermaid/svg-renderer@5.1.0
  - @zombie-mermaid/ascii-renderer@5.1.0
  - @zombie-mermaid/mermaid-parser@5.1.0
  - @zombie-mermaid/core@5.1.0

## 5.0.1

### Patch Changes

- Updated dependencies [[`23007f5`](https://github.com/dfadler/zombie-mermaid/commit/23007f5b3356f3531b2a25aebab3aa9974836015), [`000bea2`](https://github.com/dfadler/zombie-mermaid/commit/000bea2eefcf178646f6a90d2e364b603d191954), [`2e01fc8`](https://github.com/dfadler/zombie-mermaid/commit/2e01fc855e13681f808cbbd8331763cfc677508f)]:
  - @zombie-mermaid/ascii-renderer@5.0.1
  - @zombie-mermaid/core@5.0.1
  - @zombie-mermaid/mermaid-parser@5.0.1
  - @zombie-mermaid/svg-renderer@5.0.1

## 5.0.0

### Major Changes

- [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444) [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1) Thanks [@dfadler](https://github.com/dfadler)! - **BREAKING:** `elkjs` is now an optional peer dependency of `@zombie-mermaid/svg-renderer` (and no longer a dependency of `@zombie-mermaid/core`), and the library no longer imports it. Browser and bundler apps that render flowchart, state, class, ER or architecture diagrams must `npm install elkjs` and call the new `registerElk(ELK)` once (`import ELK from 'elkjs/lib/elk.bundled.js'`); otherwise rendering those diagrams throws `ElkNotRegisteredError`. Under Node and Bun, `elkjs` is auto-loaded when installed, and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so the CLI and MCP server need no change. Sequence, pie, xychart, C4 and ASCII output never needed it. In exchange, the SVG renderer's browser bundle drops from about 518 KB to 74 KB gzipped (umbrella 576 KB to 130 KB) when elk is not registered, and the published `.d.ts` files no longer import from `elkjs` (the `Elk*` graph types are now exported by `@zombie-mermaid/core`). See `docs/guides/elkjs-optional-peer.md`.

### Patch Changes

- [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3) Thanks [@dfadler](https://github.com/dfadler)! - Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop the unused `entities` dependency declaration from mcp (refs [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426)).
- Updated dependencies [[`4503879`](https://github.com/dfadler/zombie-mermaid/commit/4503879bc8a8e6278af76d7e2d01169d1818c665), [`a729295`](https://github.com/dfadler/zombie-mermaid/commit/a72929571406147b3676107e2c5d5d6abbd703fc), [`e38848d`](https://github.com/dfadler/zombie-mermaid/commit/e38848dd48e66b732c6fd7f0c667e91643c2840c), [`b7d7c58`](https://github.com/dfadler/zombie-mermaid/commit/b7d7c580281cea1c184bc7e4d0b3aeb77861a098), [`e16dc91`](https://github.com/dfadler/zombie-mermaid/commit/e16dc91291843c52b960efd1f425f0fc33bdb915), [`b4a89b4`](https://github.com/dfadler/zombie-mermaid/commit/b4a89b4434815220373dcaea9c5eb963a3d811b8), [`4d8a9e4`](https://github.com/dfadler/zombie-mermaid/commit/4d8a9e424ba691a45aac4e37bcd6f6d2b5b0292d), [`105f069`](https://github.com/dfadler/zombie-mermaid/commit/105f069435db9ebf1b33a15aff770b2f77b134d8), [`6202ea2`](https://github.com/dfadler/zombie-mermaid/commit/6202ea2667ebefef4e394e9b6856f8ff081dc41f), [`89c25c4`](https://github.com/dfadler/zombie-mermaid/commit/89c25c44f24c2e6ae61c84e217ee1afa22e58e16), [`204487a`](https://github.com/dfadler/zombie-mermaid/commit/204487a85e1eff57ccedf2900d3b4e6f426e5125), [`78df967`](https://github.com/dfadler/zombie-mermaid/commit/78df96703c21c262f7aa8a4285d79f1ae5ebcca2), [`ad232b8`](https://github.com/dfadler/zombie-mermaid/commit/ad232b81d037f045114990f96a406ef554be94a3), [`645fd05`](https://github.com/dfadler/zombie-mermaid/commit/645fd05d8e62ea5acdcb7573fea6d8aba50be6ad), [`5c8967b`](https://github.com/dfadler/zombie-mermaid/commit/5c8967b26c0d290473d27701f0059d30332603c6), [`3be6d07`](https://github.com/dfadler/zombie-mermaid/commit/3be6d07368e5087f1b9da80dbfaa9edb5828f3b2), [`213ae4a`](https://github.com/dfadler/zombie-mermaid/commit/213ae4aa12799ab5d88c2c8234d3fad584b20e82), [`cd6153b`](https://github.com/dfadler/zombie-mermaid/commit/cd6153b0defff666120ec93149a0d3c163d92838), [`36448f7`](https://github.com/dfadler/zombie-mermaid/commit/36448f784cc7de50cfe90d71fcbe5c5eb80f5d1a), [`3b4c0ad`](https://github.com/dfadler/zombie-mermaid/commit/3b4c0adfbaa9f889b3c471d8100af40acc11f11e), [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1), [`4583ab7`](https://github.com/dfadler/zombie-mermaid/commit/4583ab743e1634ed06c274d62bf674f53086544f), [`5ca72d5`](https://github.com/dfadler/zombie-mermaid/commit/5ca72d5e2bda0a0430f828b708ff0c32630af31f), [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3)]:
  - @zombie-mermaid/ascii-renderer@5.0.0
  - @zombie-mermaid/core@5.0.0
  - @zombie-mermaid/mermaid-parser@5.0.0
  - @zombie-mermaid/svg-renderer@5.0.0

## 4.2.3

### Patch Changes

- Updated dependencies [[`3cfd4c0`](https://github.com/dfadler/zombie-mermaid/commit/3cfd4c0d5f1cdf3dae82f4e5fd8a934f6ef8b70b), [`1bfc76e`](https://github.com/dfadler/zombie-mermaid/commit/1bfc76ecd6db50b18d9d6b147863ce60fd65d2e3), [`cfa74cd`](https://github.com/dfadler/zombie-mermaid/commit/cfa74cded88f56b88f228f0f886d5d83689e7eff), [`1f524f8`](https://github.com/dfadler/zombie-mermaid/commit/1f524f8cb074eca81b2c9aedd0bb51788356f48a), [`555cbfb`](https://github.com/dfadler/zombie-mermaid/commit/555cbfbe627df56261d2191a0e3b7286e4d33f0d), [`2a29580`](https://github.com/dfadler/zombie-mermaid/commit/2a295809f975afe7a1f9c00a5f45c46c03d2cc93), [`c0eed80`](https://github.com/dfadler/zombie-mermaid/commit/c0eed80f2abe099733b169ef7a2f348077a2e903), [`a637027`](https://github.com/dfadler/zombie-mermaid/commit/a6370270f9afed0a4e4cdfac6c40a08468344e6b), [`2f9993c`](https://github.com/dfadler/zombie-mermaid/commit/2f9993cf88961c532225a406b6a9f911a401c3bc)]:
  - @zombie-mermaid/ascii-renderer@4.2.3
  - @zombie-mermaid/svg-renderer@4.2.3
  - @zombie-mermaid/core@4.2.3
  - @zombie-mermaid/mermaid-parser@4.2.3

## 4.2.2

### Patch Changes

- Updated dependencies [[`b4091ce`](https://github.com/dfadler/zombie-mermaid/commit/b4091ce0c90c3ea3b5bd1bdf0d2471f22ec1f1f9), [`cb7d2ab`](https://github.com/dfadler/zombie-mermaid/commit/cb7d2ab91d4a7c91e4dabedcfa6ab121450a8c2e)]:
  - @zombie-mermaid/ascii-renderer@4.2.2
  - @zombie-mermaid/svg-renderer@4.2.2
  - @zombie-mermaid/core@4.2.2
  - @zombie-mermaid/mermaid-parser@4.2.2

## 4.2.1

### Patch Changes

- Updated dependencies [[`245e76b`](https://github.com/dfadler/zombie-mermaid/commit/245e76b8c32e4e3234414d68a8bfb7de522f8cc4)]:
  - @zombie-mermaid/ascii-renderer@4.2.1
  - @zombie-mermaid/core@4.2.1
  - @zombie-mermaid/mermaid-parser@4.2.1
  - @zombie-mermaid/svg-renderer@4.2.1

## 4.2.0

### Patch Changes

- [#1371](https://github.com/dfadler/zombie-mermaid/pull/1371) [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 1: parsing and detection. `DiagramType` gains `'pie'`, and `detectDiagramType` routes a `pie` header to it (case-sensitively, as Mermaid does). `@zombie-mermaid/mermaid-parser` adds `parsePieChart` with the `PieChart`/`PieSlice` types (title, accTitle, accDescr, showData, slices in source order). The parser accepts and rejects the same input as Mermaid's own pie grammar: labels must be quoted, negative values are errors, zero is allowed, a repeated label keeps its first value, `showData` is only valid on the header line, and a bare `pie` with no slices is valid. `renderMermaidSVG` and `renderMermaidASCII` route a pie chart to the pie parser (so syntax errors are reported with their line) instead of misrouting it to the flowchart parser; the rendering itself is covered by the separate pie SVG and ASCII renderer changesets. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with strictness ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.
- Updated dependencies [[`6f4b53a`](https://github.com/dfadler/zombie-mermaid/commit/6f4b53a8b5610cf09025b32983d53dc3d7ac3aa9), [`c12701b`](https://github.com/dfadler/zombie-mermaid/commit/c12701bef5199ce826bf94d6752f48a641be104a), [`907dfd8`](https://github.com/dfadler/zombie-mermaid/commit/907dfd82a8f28ca97d800dbfd9578d77bd6a3e92), [`d08774b`](https://github.com/dfadler/zombie-mermaid/commit/d08774b6bc50febc270517f590b647e945fdb832), [`9ef5170`](https://github.com/dfadler/zombie-mermaid/commit/9ef5170e2d182e178d278f9babff4f16dc955bcf), [`163971e`](https://github.com/dfadler/zombie-mermaid/commit/163971e94e0a82d8b9b083b10b80883a74b8ad9e), [`e8c1a17`](https://github.com/dfadler/zombie-mermaid/commit/e8c1a17611c522c67bf3c1a2b2b407ef4e245208), [`85b1a50`](https://github.com/dfadler/zombie-mermaid/commit/85b1a50bad3ab93348e65469a5b343ac0a1683b5), [`3e73862`](https://github.com/dfadler/zombie-mermaid/commit/3e73862ebe6b9a72532efc360df773b1818ceca2), [`571a164`](https://github.com/dfadler/zombie-mermaid/commit/571a164cce7189a1bdf5aeabd8c3a0131d999c0f), [`b969f18`](https://github.com/dfadler/zombie-mermaid/commit/b969f185961dff1dc695516676b57db110bdf6c5), [`57105eb`](https://github.com/dfadler/zombie-mermaid/commit/57105eb7412473e1270503b78498aa508a76e7d8), [`cf496ab`](https://github.com/dfadler/zombie-mermaid/commit/cf496ab5bb0ceb39f7399364ac09a07787855e5e), [`700b97b`](https://github.com/dfadler/zombie-mermaid/commit/700b97bcbf5adeec39a438e7257fff71deff6fb6), [`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2), [`d1e8208`](https://github.com/dfadler/zombie-mermaid/commit/d1e8208919305e90d377783e8975da05fd0f214b), [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7), [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64)]:
  - @zombie-mermaid/ascii-renderer@4.2.0
  - @zombie-mermaid/mermaid-parser@4.2.0
  - @zombie-mermaid/core@4.2.0
  - @zombie-mermaid/svg-renderer@4.2.0

## 4.1.0

### Patch Changes

- Updated dependencies [[`ab5ff8f`](https://github.com/dfadler/zombie-mermaid/commit/ab5ff8f6a8000963db021b6a851b6abaea5939d8), [`c392d1a`](https://github.com/dfadler/zombie-mermaid/commit/c392d1a0535dfdc11465114aa1a2c77397fd7c9b), [`ca51046`](https://github.com/dfadler/zombie-mermaid/commit/ca51046c8bc541c1442d7f9551fa9413137b40d0), [`0b2b607`](https://github.com/dfadler/zombie-mermaid/commit/0b2b6075769376cb9909e906591e1ec94eb6edad), [`490de7c`](https://github.com/dfadler/zombie-mermaid/commit/490de7c7d3a0d8074bed3e68c052effd91914016), [`9be4d36`](https://github.com/dfadler/zombie-mermaid/commit/9be4d3692fee826d22b997a4aa5289fadbc8e8bb), [`42e2e0c`](https://github.com/dfadler/zombie-mermaid/commit/42e2e0c576bb61f0bd193977c74d3bc045825d14), [`7ab83e5`](https://github.com/dfadler/zombie-mermaid/commit/7ab83e5a56f03ced457aa310dfb7ce27b3a87fb6), [`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277), [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36)]:
  - @zombie-mermaid/ascii-renderer@4.1.0
  - @zombie-mermaid/svg-renderer@4.1.0
  - @zombie-mermaid/core@4.1.0
  - @zombie-mermaid/mermaid-parser@4.1.0

## 4.0.0

### Patch Changes

- Updated dependencies [[`9d18ee7`](https://github.com/dfadler/zombie-mermaid/commit/9d18ee79afb97e7d360e4314532126c39048280a), [`f6eb9e2`](https://github.com/dfadler/zombie-mermaid/commit/f6eb9e258aa7a51b3155e31e67b2fa712eca9916), [`d1d1ca4`](https://github.com/dfadler/zombie-mermaid/commit/d1d1ca4a3ecc68a41769e0911c98ddca60c90de1), [`4b2e887`](https://github.com/dfadler/zombie-mermaid/commit/4b2e887d6329e6923468a9e7baf80d327fb82891), [`bcdf5aa`](https://github.com/dfadler/zombie-mermaid/commit/bcdf5aa2aca2ed79d3f92fa3fae37ad75b152f23), [`bddc87f`](https://github.com/dfadler/zombie-mermaid/commit/bddc87f2bf9a7e82b3fa33d6a7cd245dfb60639b), [`02b9efb`](https://github.com/dfadler/zombie-mermaid/commit/02b9efba372f288c6f3670fcc69fb11e76015f0a), [`7ae4525`](https://github.com/dfadler/zombie-mermaid/commit/7ae45258a332b07ac546da11d8936946d36949d0), [`43475ff`](https://github.com/dfadler/zombie-mermaid/commit/43475ff759b6f52d41d2c7c2911dae963a6c6ef2), [`6cdacb6`](https://github.com/dfadler/zombie-mermaid/commit/6cdacb6a2dcd857d4328a2890cc29d290274bfe4), [`20db743`](https://github.com/dfadler/zombie-mermaid/commit/20db743be4508a59d57bfe81a97fb916910b2a54), [`f768c85`](https://github.com/dfadler/zombie-mermaid/commit/f768c85ebaeafe720db67ece57c51c26fb2dad28), [`5e42179`](https://github.com/dfadler/zombie-mermaid/commit/5e42179d915ae3a386e7df48314794413ddbd94b), [`618923e`](https://github.com/dfadler/zombie-mermaid/commit/618923e0f51503bff2ba79cae91ddabf2283b035), [`c7d9704`](https://github.com/dfadler/zombie-mermaid/commit/c7d9704c9cbc9f39d3408a0d4cac124e2e1852dc), [`f244b08`](https://github.com/dfadler/zombie-mermaid/commit/f244b089f6fc4c4a24bb25da961d9018077ade03), [`26e2a77`](https://github.com/dfadler/zombie-mermaid/commit/26e2a7753a87f91bd3de6134c59c8e12e4d249a3), [`642a1a9`](https://github.com/dfadler/zombie-mermaid/commit/642a1a9ea83e118e1414a0f05031b71a60289edd), [`89e915f`](https://github.com/dfadler/zombie-mermaid/commit/89e915ff838a140dbac4bc6452e4460cf766693c), [`e894cf0`](https://github.com/dfadler/zombie-mermaid/commit/e894cf060c0fc25254250a9894d39cef0c13a0d2), [`56d3b72`](https://github.com/dfadler/zombie-mermaid/commit/56d3b7287bd7aba20256ad054630635ece2826e1), [`66411fb`](https://github.com/dfadler/zombie-mermaid/commit/66411fb023e7d6eed50957a0fd6e934572254c0a), [`c2980a2`](https://github.com/dfadler/zombie-mermaid/commit/c2980a26503ab5c7a4a38407ee29feec128ba7d6), [`7e4db32`](https://github.com/dfadler/zombie-mermaid/commit/7e4db3206ab61740b54f427003ab3fb248001d66), [`426b6bb`](https://github.com/dfadler/zombie-mermaid/commit/426b6bb6ba868af9e9e4dc295ac64dca4111654d), [`cff9e1f`](https://github.com/dfadler/zombie-mermaid/commit/cff9e1ffb2c78861b14c392d866497cb4995f03a), [`ed7f645`](https://github.com/dfadler/zombie-mermaid/commit/ed7f6458ed983e25d55b0ca2e6c0cae2cfd63d88), [`7b796fa`](https://github.com/dfadler/zombie-mermaid/commit/7b796fac35b99f1e1dcd5fa9f54838c1d1a9dc3e)]:
  - @zombie-mermaid/ascii-renderer@4.0.0
  - @zombie-mermaid/svg-renderer@4.0.0
  - @zombie-mermaid/mermaid-parser@4.0.0
  - @zombie-mermaid/core@4.0.0

## 3.2.0

### Minor Changes

- [#1192](https://github.com/dfadler/zombie-mermaid/pull/1192) [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1) Thanks [@dfadler](https://github.com/dfadler)! - Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII with dedicated renderers. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, which records `Rel_U/D/L/R` placement hints. The SVG renderer lays out with ELK (nested boundaries, relationships to boundaries) and draws a person glyph, cylinders, queues, the C4 palette, boundary frames, a title, and relationship labels with a separate `[technology]` line. The ASCII renderer has its own row layout, boxes, boundary frames, and grid router. `Rel_D`/`Rel_U` steer layering; `Rel_R`/`Rel_L` place elements side by side (exact in ASCII, a best-effort nudge in SVG). Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (devx), both unmerged upstream; nothing was copied from either renderer; the parser and integration fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (adapted, with known gaps marked as skipped). ArchiMate remains open under [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167).

- [#1179](https://github.com/dfadler/zombie-mermaid/pull/1179) [`f51b9e8`](https://github.com/dfadler/zombie-mermaid/commit/f51b9e8a8610334f0fe498e9b8b219a036e79085) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: when `render_mermaid_svg` or `render_mermaid_ascii` fails on a diagram whose parser reports a line, the error result now carries a second text block with `{"diagnostics":[{"line","sourceLine","message"}]}` (1-based line in the submitted source, the offending line verbatim, and the parser message). The first content block and `isError: true` are unchanged; errors with no line information (for example an empty diagram) return only the plain message. No column is reported because no parser tracks one, and no lines are stripped or partially rendered.

### Patch Changes

- Updated dependencies [[`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9), [`84f70d4`](https://github.com/dfadler/zombie-mermaid/commit/84f70d4f72c8f6951c14ba5ec795247e12cca383), [`ad28261`](https://github.com/dfadler/zombie-mermaid/commit/ad282610307f63bf8782e08534a4a127c6afaacd), [`7e43e46`](https://github.com/dfadler/zombie-mermaid/commit/7e43e46f12cf90680d8dde7df147e73527108462), [`d3f0524`](https://github.com/dfadler/zombie-mermaid/commit/d3f052484f932e902e2c0d64be9621a56a9f17e7), [`77f88b0`](https://github.com/dfadler/zombie-mermaid/commit/77f88b0a3d4fc44942deb6686d726b36435e5d6d), [`502b06b`](https://github.com/dfadler/zombie-mermaid/commit/502b06b111f8d3379287322e5b061585b7fc82e5), [`b742dca`](https://github.com/dfadler/zombie-mermaid/commit/b742dcaf14c5d4d03346a58c1bf4842b745a5279), [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1), [`54432b6`](https://github.com/dfadler/zombie-mermaid/commit/54432b6206c1af5d2e2d4fdd447256d9bbbcc85b), [`cdd34dd`](https://github.com/dfadler/zombie-mermaid/commit/cdd34dd8c93ec3768320b6b23384f143e2180db5), [`b4903df`](https://github.com/dfadler/zombie-mermaid/commit/b4903df714cefa036f33e54081b97b56f2248cab), [`f01ed87`](https://github.com/dfadler/zombie-mermaid/commit/f01ed8761b156c33d88a3b9fb9bc21c805675085), [`b88c5bc`](https://github.com/dfadler/zombie-mermaid/commit/b88c5bc2e28cff949282516984fba9d47bb46416), [`aea9109`](https://github.com/dfadler/zombie-mermaid/commit/aea9109b754cf231ebc7a4fababf5819487febd0)]:
  - @zombie-mermaid/core@3.2.0
  - @zombie-mermaid/mermaid-parser@3.2.0
  - @zombie-mermaid/svg-renderer@3.2.0
  - @zombie-mermaid/ascii-renderer@3.2.0

## 3.1.0

### Minor Changes

- [#1173](https://github.com/dfadler/zombie-mermaid/pull/1173) [`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: `render_mermaid_svg` gains optional `bg`/`fg` hex color overrides (applied on top of `theme`) and an optional `outputPath` that writes the SVG to a `.svg` file and returns `{ saved, size }`. `outputPath` is path-safe: it must resolve inside the server's working directory, the parent must already exist, and symlinks, `..` traversal, and non-regular files are refused. Because it can write files, `render_mermaid_svg` is now annotated `readOnlyHint: false, destructiveHint: true`. Two new tools, `list_themes` and `list_diagram_types`, list the valid `theme` names and the supported diagram types. `@zombie-mermaid/core` now exports a runtime `DIAGRAM_TYPES` array that `DiagramType` is derived from.

  Adapted by hand (not imported) from upstream lukilabs/beautiful-mermaid#120 (by LordCasser) and [#42](https://github.com/dfadler/zombie-mermaid/issues/42) (by manuareraa), keeping this fork's camelCase inputs and enum theme validation.

### Patch Changes

- Updated dependencies [[`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e), [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34)]:
  - @zombie-mermaid/core@3.1.0
  - @zombie-mermaid/svg-renderer@3.1.0
  - @zombie-mermaid/ascii-renderer@3.1.0
  - @zombie-mermaid/mermaid-parser@3.1.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`508b508`](https://github.com/dfadler/zombie-mermaid/commit/508b5083e74088b1a6163016b24cfc4c32f93ebb), [`451b981`](https://github.com/dfadler/zombie-mermaid/commit/451b98195e3370eb4a3beb66071396d5c616dbad), [`0849aba`](https://github.com/dfadler/zombie-mermaid/commit/0849abafc62e6cd94e38318e9edf6fe27634b49a), [`28698cd`](https://github.com/dfadler/zombie-mermaid/commit/28698cd7d706bb429f56edc0d38a185fde65120e), [`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130), [`c2a190d`](https://github.com/dfadler/zombie-mermaid/commit/c2a190df3c86e7b3394e853d437fc3d11b7634e4), [`87f74e4`](https://github.com/dfadler/zombie-mermaid/commit/87f74e42c9cccbdd677ab2af17f4b3c415350948), [`d9e306f`](https://github.com/dfadler/zombie-mermaid/commit/d9e306f91003c9e47da10944833f76c2b87ace22)]:
  - @zombie-mermaid/ascii-renderer@3.0.0
  - @zombie-mermaid/core@3.0.0
  - @zombie-mermaid/mermaid-parser@3.0.0
  - @zombie-mermaid/svg-renderer@3.0.0

## 2.2.6

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@2.2.6
  - @zombie-mermaid/core@2.2.6
  - @zombie-mermaid/mermaid-parser@2.2.6
  - @zombie-mermaid/svg-renderer@2.2.6

## 2.2.5

### Patch Changes

- Updated dependencies [[`43bac5a`](https://github.com/dfadler/zombie-mermaid/commit/43bac5abfb13064623ad94042b20ca9f4251fdaf)]:
  - @zombie-mermaid/ascii-renderer@2.2.5
  - @zombie-mermaid/core@2.2.5
  - @zombie-mermaid/mermaid-parser@2.2.5
  - @zombie-mermaid/svg-renderer@2.2.5

## 2.2.1

### Patch Changes

- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66), [`7b32f48`](https://github.com/dfadler/zombie-mermaid/commit/7b32f48fa2a9488b66a94bdd43ad4be134d74349), [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043)]:
  - @zombie-mermaid/ascii-renderer@2.2.1
  - @zombie-mermaid/core@2.2.1
  - @zombie-mermaid/mermaid-parser@2.2.1
  - @zombie-mermaid/svg-renderer@2.2.1
