# @zombie-mermaid/svg-renderer

## 5.5.0

### Minor Changes

- [#2067](https://github.com/dfadler/zombie-mermaid/pull/2067) [`e21b993`](https://github.com/dfadler/zombie-mermaid/commit/e21b993aec9aa7b3c6f3e747aeb0e98bdf9ac08b) Thanks [@dfadler](https://github.com/dfadler)! - Draw the sequence `participant X@{ "type": ... }` kinds (boundary, control, entity, database, collections, queue). SVG draws Mermaid's icons and box variants with the theme's node tokens; ASCII adds a one-line marker above the label, the same in the unicode and ASCII charsets. Unknown types keep the plain box.

### Patch Changes

- [#2075](https://github.com/dfadler/zombie-mermaid/pull/2075) [`0a493e2`](https://github.com/dfadler/zombie-mermaid/commit/0a493e21c78e6d259996bb2b65dbd63ae689ab3c) Thanks [@dfadler](https://github.com/dfadler)! - Flowcharts: three or more labelled edges between the same two nodes now spread apart more, so the target sits off the source's column the way mermaid 12.1.0 and 12.2.0 draw it (for example `T` in the Five Cluster Exit Siblings sample).

- [#2060](https://github.com/dfadler/zombie-mermaid/pull/2060) [`efb2ade`](https://github.com/dfadler/zombie-mermaid/commit/efb2ade09c6bfbe05b49ea5b7f3961b1d5794fb6) Thanks [@dfadler](https://github.com/dfadler)! - Flowcharts: an edge that leaves a subgraph and comes back to it is now laid out as the feedback edge, the way mermaid 12's ELK layout orients it. In the CI/CD Pipeline sample `Fix & Retry` now sits beside `Build Image` instead of below `QA Approved?`.
- Updated dependencies []:
  - @zombie-mermaid/core@5.5.0
  - @zombie-mermaid/mermaid-parser@5.5.0

## 5.4.0

### Minor Changes

- [#2048](https://github.com/dfadler/zombie-mermaid/pull/2048) [`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d) Thanks [@dfadler](https://github.com/dfadler)! - Support Mermaid's `accTitle:` / `accDescr:` (single-line and `accDescr { ... }`) on every diagram type, not just pie. In SVG, `accTitle` names the root (the `title` option still wins) and `accDescr` becomes `<desc>` with `aria-describedby`; both go through the one `svgOpenTag()`. ASCII output ignores the statements and is byte-identical. New `extractAccessibility()` in `@zombie-mermaid/core`.

### Patch Changes

- [#2023](https://github.com/dfadler/zombie-mermaid/pull/2023) [`0c2b6d3`](https://github.com/dfadler/zombie-mermaid/commit/0c2b6d3ec38fb97bcc927573b82de06fd83c9492) Thanks [@dfadler](https://github.com/dfadler)! - Class diagrams now centre a parent over its children, as mermaid does (ELK `BALANCED` node placement).

- [#2051](https://github.com/dfadler/zombie-mermaid/pull/2051) [`36f8c04`](https://github.com/dfadler/zombie-mermaid/commit/36f8c049eb94c3eef47c4a07a61ea7231c837d57) Thanks [@dfadler](https://github.com/dfadler)! - Support elkjs 0.12.0. The optional `elkjs` peer range of `@zombie-mermaid/svg-renderer` widens from `^0.11.0` to `^0.11.0 || ^0.12.0`, so both versions keep working; layouts are identical on both. `zombie-mermaid` (CLI) now depends on `elkjs@^0.12.0`. Closes [#1907](https://github.com/dfadler/zombie-mermaid/issues/1907).

- [#2013](https://github.com/dfadler/zombie-mermaid/pull/2013) [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8) Thanks [@dfadler](https://github.com/dfadler)! - Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in [#1596](https://github.com/dfadler/zombie-mermaid/issues/1596)) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).

- [#2018](https://github.com/dfadler/zombie-mermaid/pull/2018) [`782eaa0`](https://github.com/dfadler/zombie-mermaid/commit/782eaa00d9e8d0a8503bc2c4039c5ab4a22467a6) Thanks [@dfadler](https://github.com/dfadler)! - Output change: in an SVG flowchart without subgraphs, a sink node reached by a labeled edge now sits beside its siblings instead of one layer below them, as mermaid.js (12.1.0 and 12.2.0) draws it. The "Decision Tree" sample is the example. ASCII output is unchanged. Fixes [#1750](https://github.com/dfadler/zombie-mermaid/issues/1750).
- Updated dependencies [[`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d), [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8), [`adf9f32`](https://github.com/dfadler/zombie-mermaid/commit/adf9f32494a78701c37894dfcb6c4a96344b7447), [`38e2b3c`](https://github.com/dfadler/zombie-mermaid/commit/38e2b3c00efe238bb9afe8683f6758a6f23a0996)]:
  - @zombie-mermaid/core@5.4.0
  - @zombie-mermaid/mermaid-parser@5.4.0

## 5.3.0

### Minor Changes

- [#1984](https://github.com/dfadler/zombie-mermaid/pull/1984) [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a) Thanks [@dfadler](https://github.com/dfadler)! - Add `limits` to `renderMermaidSVG` and `renderMermaidASCII`: `maxInputLength`, `maxNodes`, `maxEdges` (and `maxCanvasCells` for ASCII) are checked before layout and throw `LimitExceededError` (`code: 'LIMIT_EXCEEDED'`). Defaults are 100,000 characters, 400 nodes, 600 edges and 2,000,000 canvas cells, so a flowchart above 400 nodes or 600 edges now throws unless you raise the limit (`Infinity` disables one). The MCP render tools use tighter limits (50,000 / 150 / 300 / 1,000,000). See the API reference.

### Patch Changes

- [#1965](https://github.com/dfadler/zombie-mermaid/pull/1965) [`fa02ffe`](https://github.com/dfadler/zombie-mermaid/commit/fa02ffe3ab869d1d92d87ce67d82b2e8ce4ff1f9) Thanks [@dfadler](https://github.com/dfadler)! - Output change: a C4 SVG boundary that holds nothing no longer runs past the right edge of the SVG; the diagram is now wide enough for its default-width frame. ASCII output is unchanged. Fixes [#1909](https://github.com/dfadler/zombie-mermaid/issues/1909).

- [#1976](https://github.com/dfadler/zombie-mermaid/pull/1976) [`e63ed98`](https://github.com/dfadler/zombie-mermaid/commit/e63ed989d8179d428149d1f48e31e78a87f261f3) Thanks [@dfadler](https://github.com/dfadler)! - Fix flowchart and state diagrams with several disconnected, widely-labelled edges throwing ELK's "Invalid hitboxes for scanline constraint calculation" instead of rendering ([#1813](https://github.com/dfadler/zombie-mermaid/issues/1813)).

- [#1982](https://github.com/dfadler/zombie-mermaid/pull/1982) [`858a8ba`](https://github.com/dfadler/zombie-mermaid/commit/858a8ba39898b95678c300120590130835f7445d) Thanks [@dfadler](https://github.com/dfadler)! - Flowcharts: sibling subgraphs tied together by a shared outside node (`E --> A`, `E --> C`) now keep declaration order left to right, as mermaid 12 draws them. Unconnected siblings stay reversed. Nested Subgraphs horizontal agreement with mermaid 12.1.0 goes from 20% to 100%. Refs [#1904](https://github.com/dfadler/zombie-mermaid/issues/1904).

- [#1968](https://github.com/dfadler/zombie-mermaid/pull/1968) [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce) Thanks [@dfadler](https://github.com/dfadler)! - Source maps no longer embed `sourcesContent`, cutting the shipped `.map` files by about 70% (svg-renderer 1532K to 404K, ascii-renderer 2384K to 556K on disk). Stack traces keep their line numbers. Refs [#1871](https://github.com/dfadler/zombie-mermaid/issues/1871).
- Updated dependencies [[`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a), [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce), [`5e4a9a7`](https://github.com/dfadler/zombie-mermaid/commit/5e4a9a71b2f07c8eceaed50dc764504525065675), [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5), [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d)]:
  - @zombie-mermaid/core@5.3.0
  - @zombie-mermaid/mermaid-parser@5.3.0

## 5.2.0

### Minor Changes

- [#1930](https://github.com/dfadler/zombie-mermaid/pull/1930) [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9) Thanks [@dfadler](https://github.com/dfadler)! - Output change: pie charts now honour `%%{init: {"pie": {"legendPosition": ...}}}%%` and `highlightSlice` in SVG, as Mermaid 12.1.0 does. `legendPosition` takes `right` (the default, unchanged), `left`, `top`, `bottom` or `center`: left and top shift the pie to make room, top and bottom make the frame taller, and center draws the legend over the pie. An unknown value draws the default. `highlightSlice: "<label>"` draws the slice with that exact label 5% larger and fully opaque; `hover` has no meaning in a static image and is ignored. Charts that set neither option are byte-identical, and the ASCII output ignores both. Closes [#1725](https://github.com/dfadler/zombie-mermaid/issues/1725) and [#1726](https://github.com/dfadler/zombie-mermaid/issues/1726).

- [#1931](https://github.com/dfadler/zombie-mermaid/pull/1931) [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef) Thanks [@dfadler](https://github.com/dfadler)! - New option `layout: 'simple'` on `renderMermaidSVG` and the flowchart layout functions: a small built-in layered layout (longest-path ranks, barycenter crossing reduction, least-squares coordinates) that lays flowcharts out without `elkjs`, so SVG flowcharts work in a size-sensitive browser bundle. It adds about 3.5 KB gzipped. It is opt-in and never an automatic fallback: **default output is unchanged** (unset and `layout: 'elk'` are byte-identical to before). Flowcharts only; state, class, ER and architecture diagrams ignore it and still need `elkjs`. It ignores `mergeEdges`, `layoutCache` and a subgraph's own `direction`. Placement agreement with mermaid 12.1.0 on the flowchart samples is within 1 point of ELK's (see `docs/decisions/simple-layout-1685.md`). `pnpm run layout:oracle -- --layout=simple` scores it. Refs [#1685](https://github.com/dfadler/zombie-mermaid/issues/1685).

### Patch Changes

- [#1910](https://github.com/dfadler/zombie-mermaid/pull/1910) [`fda110d`](https://github.com/dfadler/zombie-mermaid/commit/fda110dd94834fc268a8b49e3b2b0df56bd873ba) Thanks [@dfadler](https://github.com/dfadler)! - Output change: C4 SVG relationship labels no longer sit on shapes, boundary frames, boundary headings, other labels or other lines. A label is now slid along its line, set up to 28px to either side of it, or wrapped narrower (`PositionedC4Relationship` gains an optional `labelLines`) to find a clear spot, and is drawn on a background plate as flowchart edge labels are. A C4 person is now one outline, so the head no longer draws a second outline across the body (`<path class="c4-person-shape">` replaces the `<rect>` and `<circle>` pair). ASCII output is unchanged. Fixes [#1908](https://github.com/dfadler/zombie-mermaid/issues/1908).

- [#1922](https://github.com/dfadler/zombie-mermaid/pull/1922) [`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1) Thanks [@dfadler](https://github.com/dfadler)! - Output change: an invalid `fill`, `stroke` or `color` value in a flowchart, state or class diagram `style`, `classDef` or `linkStyle` (`fill:notacolor`, `fill:rgb(x)`, `stroke:[#12345](https://github.com/dfadler/zombie-mermaid/issues/12345)`) is now ignored, as Mermaid does, instead of being written into the SVG as `fill="notacolor"`, which browsers paint as a black node, no border or no link line. Only the bad declaration is dropped; the other declarations in the same rule and the theme paint stay. Valid CSS colours (hex, named, `rgb()`, `hsl()`, `oklch()`, `color()`, `var()`, `color-mix()`, `none`, `transparent`, `currentColor`) are unchanged, and ASCII output is unchanged. State `classDef` is covered as well: it started painting a bad colour when state styling was added in 3.2.0. Fixes [#1918](https://github.com/dfadler/zombie-mermaid/issues/1918).
- Updated dependencies [[`fda110d`](https://github.com/dfadler/zombie-mermaid/commit/fda110dd94834fc268a8b49e3b2b0df56bd873ba), [`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1), [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9), [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef), [`ebdd12f`](https://github.com/dfadler/zombie-mermaid/commit/ebdd12f58f7379dddfa9c93541543349bba5612a)]:
  - @zombie-mermaid/mermaid-parser@5.2.0
  - @zombie-mermaid/core@5.2.0

## 5.1.0

### Minor Changes

- [#1727](https://github.com/dfadler/zombie-mermaid/pull/1727) [`ce29689`](https://github.com/dfadler/zombie-mermaid/commit/ce2968907a79cbbb0f81f50eb70ce80b4f0e2da1) Thanks [@dfadler](https://github.com/dfadler)! - Add a `validate_mermaid` MCP tool and a `zombie-mermaid validate [file]` CLI command (parse only, line diagnostics, exit 1 when invalid). Failed `render` runs now print the offending source line too. New `validateMermaid()` export.

### Patch Changes

- [#1639](https://github.com/dfadler/zombie-mermaid/pull/1639) [`7104031`](https://github.com/dfadler/zombie-mermaid/commit/71040311cdca8de5f3c3ce41c6d9a54209ed8b8f) Thanks [@dfadler](https://github.com/dfadler)! - Ship `THIRD_PARTY_NOTICES.md` in the published tarballs.

- [#1670](https://github.com/dfadler/zombie-mermaid/pull/1670) [`0d6711c`](https://github.com/dfadler/zombie-mermaid/commit/0d6711c1c51a57e25ede4c11e360c208ea4b9278) Thanks [@dfadler](https://github.com/dfadler)! - Fix SVG rendering of graph diagrams inside a browser Web Worker: hiding the worker-style `self` while constructing ELK no longer throws "Cannot set property self ... which has only a getter" ([#1524](https://github.com/dfadler/zombie-mermaid/issues/1524)).

- [#1620](https://github.com/dfadler/zombie-mermaid/pull/1620) [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931) Thanks [@dfadler](https://github.com/dfadler)! - Fix package README inaccuracies and add missing `package.json` metadata ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).
- Updated dependencies [[`3ec564e`](https://github.com/dfadler/zombie-mermaid/commit/3ec564ea51616fceb6facb37709313e15fb8b7d6), [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931)]:
  - @zombie-mermaid/mermaid-parser@5.1.0
  - @zombie-mermaid/core@5.1.0

## 5.0.1

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@5.0.1
  - @zombie-mermaid/mermaid-parser@5.0.1

## 5.0.0

### Major Changes

- [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444) [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1) Thanks [@dfadler](https://github.com/dfadler)! - **BREAKING:** `elkjs` is now an optional peer dependency of `@zombie-mermaid/svg-renderer` (and no longer a dependency of `@zombie-mermaid/core`), and the library no longer imports it. Browser and bundler apps that render flowchart, state, class, ER or architecture diagrams must `npm install elkjs` and call the new `registerElk(ELK)` once (`import ELK from 'elkjs/lib/elk.bundled.js'`); otherwise rendering those diagrams throws `ElkNotRegisteredError`. Under Node and Bun, `elkjs` is auto-loaded when installed, and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so the CLI and MCP server need no change. Sequence, pie, xychart, C4 and ASCII output never needed it. In exchange, the SVG renderer's browser bundle drops from about 518 KB to 74 KB gzipped (umbrella 576 KB to 130 KB) when elk is not registered, and the published `.d.ts` files no longer import from `elkjs` (the `Elk*` graph types are now exported by `@zombie-mermaid/core`). See `docs/guides/elkjs-optional-peer.md`.

### Patch Changes

- [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3) Thanks [@dfadler](https://github.com/dfadler)! - Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop the unused `entities` dependency declaration from mcp (refs [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426)).
- Updated dependencies [[`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1), [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3)]:
  - @zombie-mermaid/core@5.0.0
  - @zombie-mermaid/mermaid-parser@5.0.0

## 4.2.3

### Patch Changes

- [#1405](https://github.com/dfadler/zombie-mermaid/pull/1405) [`2f9993c`](https://github.com/dfadler/zombie-mermaid/commit/2f9993cf88961c532225a406b6a9f911a401c3bc) Thanks [@dfadler](https://github.com/dfadler)! - Scope every SVG `id` (arrowhead, class and sequence markers) and its `url(#…)` / `href="#…"` references with a per-render hash, so several diagrams inlined in one HTML document no longer share marker ids and lose their arrowheads when the first one is hidden ([#1397](https://github.com/dfadler/zombie-mermaid/issues/1397)).
- Updated dependencies []:
  - @zombie-mermaid/core@4.2.3
  - @zombie-mermaid/mermaid-parser@4.2.3

## 4.2.2

### Patch Changes

- [#1390](https://github.com/dfadler/zombie-mermaid/pull/1390) [`cb7d2ab`](https://github.com/dfadler/zombie-mermaid/commit/cb7d2ab91d4a7c91e4dabedcfa6ab121450a8c2e) Thanks [@dfadler](https://github.com/dfadler)! - SVG flowcharts: two parallel edges between differently sized, centered nodes (for example `Top <--> Bot` plus `Top <-.- Bot`) no longer kink by a fraction of a pixel just above the target node. ELK spread each edge across a node side relative to that node's own width, so the two ends landed at slightly different x values and the line stepped sideways, tilting the arrowhead off the edge's axis. Sub-1.5px jogs between two straight runs are now collapsed into one straight line.
- Updated dependencies []:
  - @zombie-mermaid/core@4.2.2
  - @zombie-mermaid/mermaid-parser@4.2.2

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
