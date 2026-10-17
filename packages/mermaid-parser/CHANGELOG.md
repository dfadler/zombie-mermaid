# @zombie-mermaid/mermaid-parser

## 5.8.0

### Minor Changes

- [#2172](https://github.com/dfadler/zombie-mermaid/pull/2172) [`423ce40`](https://github.com/dfadler/zombie-mermaid/commit/423ce401a2f9ffaad3ecfdb3241e0615d2c9bc1c) Thanks [@dfadler](https://github.com/dfadler)! - New opt-in render option `honorThemeVariables` (`RenderOptions` and `AsciiRenderOptions`, default `false`) that applies a small subset of a diagram's own `%%{init: {"themeVariables": {...}}}%%`: `primaryColor` (node fill, `surface`), `primaryBorderColor` (`border`) and `primaryTextColor` (`fg`) under `theme: "base"`, `lineColor` (`line`; flowchart under any theme, state diagram under `base`), and `pie1`..`pie12` (pie slices and legend, any theme). A colour you pass yourself always wins over the diagram's, invalid or unsafe values are ignored rather than thrown, and every other `themeVariables` key is reported in `InitConfig.ignored` as `themeVariables.<name>` instead of vanishing silently. Mermaid's derived colours (secondary/tertiary, the `base` border gradient, the other pie slices) are not computed. ASCII maps `lineColor`, `primaryBorderColor`, `primaryTextColor` and the pie colours, hex values only; `primaryColor` has no ASCII meaning. Checked against mermaid 12.1.0 and 12.2.0. With the option off, output is byte-identical (checked by hashing every gallery sample and ASCII testdata input, SVG and ASCII, before and after). New exports: `applyThemeVariables()` and the `ThemeVariables` type in `@zombie-mermaid/core`, `PieChart.sliceColors` in `@zombie-mermaid/mermaid-parser`. Closes [#2108](https://github.com/dfadler/zombie-mermaid/issues/2108).

  Level: minor. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, a new opt-in option is a minor change; nothing existing changes behaviour.

### Patch Changes

- [#2153](https://github.com/dfadler/zombie-mermaid/pull/2153) [`2ec3f0b`](https://github.com/dfadler/zombie-mermaid/commit/2ec3f0b91990ca6fb4d8fcf6565889bd5683f9ce) Thanks [@dfadler](https://github.com/dfadler)! - Class diagrams now honour `direction TB|TD|LR|RL|BT`, which the parser accepted and ignored (every class diagram was laid out top-down). SVG: all four directions, as mermaid.js lays them out (12.1.0 and 12.2.0 agree): `LR` puts each level in a column, `RL` mirrors it, `BT` flips the stack; markers, cardinalities, namespace frames, notes and lollipop names follow the new axis. ASCII: `BT` is drawn (the top-down drawing flipped, boxes kept upright, a namespace title kept on the top border, a note one rank below its class); `LR` and `RL` stay top-down, because the ASCII class layout is built from stacked level rows end to end, and this is documented in `docs/diagrams.md` and `docs/known-differences.md`. `ClassDiagram` gains an optional `direction` field. `RenderOptions.direction` still does not apply to class diagrams. Output change: SVG for class diagrams that declare `direction LR`, `RL` or `BT`, and ASCII for those that declare `BT`; every other diagram, and class diagrams with no direction line or `TB`/`TD`, are byte-identical (checked by hashing every gallery sample and ASCII testdata input, SVG and both ASCII charsets, before and after). Layout oracle for class samples unchanged, and the three new direction samples score 100% against mermaid 12.1.0. Refs [#2116](https://github.com/dfadler/zombie-mermaid/issues/2116); ASCII `LR`/`RL` are tracked in [#2158](https://github.com/dfadler/zombie-mermaid/issues/2158).

  Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, layout and glyph changes are not documented output contracts, no option semantics change (the render-time `direction` option is deliberately left ignored for class diagrams) and the new type field is optional; it fixes a parity gap, like [#2135](https://github.com/dfadler/zombie-mermaid/issues/2135).

- [#2205](https://github.com/dfadler/zombie-mermaid/pull/2205) [`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53) Thanks [@dfadler](https://github.com/dfadler)! - Package ESM output (`dist/index.js`) is now minified: tabs, newlines and comments are removed, and `@zombie-mermaid/mcp` gets identifier mangling too. About 20.7 KB less gzip across the five packages. Behavior and exports are unchanged; stack traces from the ESM build are harder to read, and the `/* @__PURE__ */` annotations are no longer in the shipped ESM (a one-export consumer bundle was the same size). Refs [#2198](https://github.com/dfadler/zombie-mermaid/issues/2198).
- Updated dependencies [[`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53), [`423ce40`](https://github.com/dfadler/zombie-mermaid/commit/423ce401a2f9ffaad3ecfdb3241e0615d2c9bc1c)]:
  - @zombie-mermaid/core@5.8.0

## 5.7.1

### Patch Changes

- [#2145](https://github.com/dfadler/zombie-mermaid/pull/2145) [`f5e5454`](https://github.com/dfadler/zombie-mermaid/commit/f5e5454136070993bb1552dec3616c2750a6f15f) Thanks [@dfadler](https://github.com/dfadler)! - Class diagrams (SVG): `A ()-- B` and `B --() A` now draw the interface the way mermaid.js does (12.1.0 and 12.2.0 agree): the name sits above or below its host with a small circle and a stem between them, instead of a class box with a circle marker on it. A class used only as an interface end gets no box; one with members, an annotation, another relationship, a note or a namespace keeps it. `()--()` is unchanged. Output change: SVG for any diagram with a one-ended lollipop moves; no other diagram changes. `PositionedClassRelationship` gains an optional `interfaceLabel` (the name's box) for these lines. Closes [#2135](https://github.com/dfadler/zombie-mermaid/issues/2135).

  Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, SVG layout and glyph changes are not output contracts (the accessibility guarantees, theme keys and documented options are unchanged), and this one brings the output in line with mermaid.js; the new type field is optional.

- Updated dependencies [[`b55b7fa`](https://github.com/dfadler/zombie-mermaid/commit/b55b7fae2b576173e6b438094d21238119947ace)]:
  - @zombie-mermaid/core@5.7.1

## 5.7.0

### Minor Changes

- [#2126](https://github.com/dfadler/zombie-mermaid/pull/2126) [`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903) Thanks [@dfadler](https://github.com/dfadler)! - Class diagrams: the parser now accepts syntax mermaid.js accepts and it used to reject with an error: the `classDiagram-v2` header (an alias of `classDiagram`), `<|--|>` / `<|..|>` / `<-->` / `<..>` / `*--*` / `o--o` (the marker is drawn at both ends, in SVG and ASCII), lollipop interfaces `()--`, `--()` and `()--()` (a hollow circle at the end of the line: `○`, or `O` with `useAscii`), and backtick-quoted class names such as `` class `Animal Class!` `` (the backticks are not drawn). Nothing that parsed before is rejected, and no existing input renders differently except the output change below; the arrow regex is built from one table, so the error for a malformed relationship now lists the longer arrow set. `ClassRelationship.markerAt` gains `'both'` and `RelationshipType` gains `'lollipop'`. Parity checked against mermaid 12.1.0 (the pin) and 12.2.0.

  Output change: in ASCII, a directional arrowhead at the `from` end of a relationship (`A <-- B`, `A <.. B`) now points into the `from` box (`▲` under it) instead of away from it (`▼`). Fixes [#2117](https://github.com/dfadler/zombie-mermaid/issues/2117).

### Patch Changes

- Updated dependencies [[`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903)]:
  - @zombie-mermaid/core@5.7.0

## 5.6.1

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@5.6.1

## 5.6.0

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@5.6.0

## 5.5.0

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@5.5.0

## 5.4.0

### Minor Changes

- [#2055](https://github.com/dfadler/zombie-mermaid/pull/2055) [`adf9f32`](https://github.com/dfadler/zombie-mermaid/commit/adf9f32494a78701c37894dfcb6c4a96344b7447) Thanks [@dfadler](https://github.com/dfadler)! - Sequence: `participant X@{ "type": "database" }` and `actor X@{ ... }` (Mermaid 12 participant config) now parse instead of failing with a misleading `unclosed "par" block` error. The type is kept on `Actor.participantType`; the icon is not drawn yet, so both renderers draw the plain participant. A malformed `@{ ... }` reports a precise parse error.

### Patch Changes

- [#2013](https://github.com/dfadler/zombie-mermaid/pull/2013) [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8) Thanks [@dfadler](https://github.com/dfadler)! - Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in [#1596](https://github.com/dfadler/zombie-mermaid/issues/1596)) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).
- Updated dependencies [[`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d), [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8), [`38e2b3c`](https://github.com/dfadler/zombie-mermaid/commit/38e2b3c00efe238bb9afe8683f6758a6f23a0996)]:
  - @zombie-mermaid/core@5.4.0

## 5.3.0

### Minor Changes

- [#2005](https://github.com/dfadler/zombie-mermaid/pull/2005) [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d) Thanks [@dfadler](https://github.com/dfadler)! - Every parser failure is now a `MermaidParseError` with `diagramType` set (and `line` where the parser knows it, now including C4 and architecture statement errors); the pie parser also sets `column`. Messages are unchanged. The MCP diagnostics read the typed `line` instead of parsing the message, so C4 and architecture errors now get a source-line diagnostic. `ElkNotRegisteredError` stays a plain `Error`: it is a missing-peer-dependency error, not a problem in the diagram. Closes [#1979](https://github.com/dfadler/zombie-mermaid/issues/1979).

### Patch Changes

- [#1968](https://github.com/dfadler/zombie-mermaid/pull/1968) [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce) Thanks [@dfadler](https://github.com/dfadler)! - Source maps no longer embed `sourcesContent`, cutting the shipped `.map` files by about 70% (svg-renderer 1532K to 404K, ascii-renderer 2384K to 556K on disk). Stack traces keep their line numbers. Refs [#1871](https://github.com/dfadler/zombie-mermaid/issues/1871).

- [#1967](https://github.com/dfadler/zombie-mermaid/pull/1967) [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5) Thanks [@dfadler](https://github.com/dfadler)! - Add `MermaidParseError` (`line`, `column`, `diagramType`, `code`, all optional) to `@zombie-mermaid/core`. Line-prefixed parser errors now throw it with the message unchanged, and the MCP parse diagnostics read `line` from it before falling back to the `Line N:` message prefix. Closes [#1855](https://github.com/dfadler/zombie-mermaid/issues/1855).
- Updated dependencies [[`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a), [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce), [`5e4a9a7`](https://github.com/dfadler/zombie-mermaid/commit/5e4a9a71b2f07c8eceaed50dc764504525065675), [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5)]:
  - @zombie-mermaid/core@5.3.0

## 5.2.0

### Minor Changes

- [#1930](https://github.com/dfadler/zombie-mermaid/pull/1930) [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9) Thanks [@dfadler](https://github.com/dfadler)! - Output change: pie charts now honour `%%{init: {"pie": {"legendPosition": ...}}}%%` and `highlightSlice` in SVG, as Mermaid 12.1.0 does. `legendPosition` takes `right` (the default, unchanged), `left`, `top`, `bottom` or `center`: left and top shift the pie to make room, top and bottom make the frame taller, and center draws the legend over the pie. An unknown value draws the default. `highlightSlice: "<label>"` draws the slice with that exact label 5% larger and fully opaque; `hover` has no meaning in a static image and is ignored. Charts that set neither option are byte-identical, and the ASCII output ignores both. Closes [#1725](https://github.com/dfadler/zombie-mermaid/issues/1725) and [#1726](https://github.com/dfadler/zombie-mermaid/issues/1726).

### Patch Changes

- [#1910](https://github.com/dfadler/zombie-mermaid/pull/1910) [`fda110d`](https://github.com/dfadler/zombie-mermaid/commit/fda110dd94834fc268a8b49e3b2b0df56bd873ba) Thanks [@dfadler](https://github.com/dfadler)! - Output change: C4 SVG relationship labels no longer sit on shapes, boundary frames, boundary headings, other labels or other lines. A label is now slid along its line, set up to 28px to either side of it, or wrapped narrower (`PositionedC4Relationship` gains an optional `labelLines`) to find a clear spot, and is drawn on a background plate as flowchart edge labels are. A C4 person is now one outline, so the head no longer draws a second outline across the body (`<path class="c4-person-shape">` replaces the `<rect>` and `<circle>` pair). ASCII output is unchanged. Fixes [#1908](https://github.com/dfadler/zombie-mermaid/issues/1908).
- Updated dependencies [[`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1), [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9), [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef), [`ebdd12f`](https://github.com/dfadler/zombie-mermaid/commit/ebdd12f58f7379dddfa9c93541543349bba5612a)]:
  - @zombie-mermaid/core@5.2.0

## 5.1.0

### Patch Changes

- [#1719](https://github.com/dfadler/zombie-mermaid/pull/1719) [`3ec564e`](https://github.com/dfadler/zombie-mermaid/commit/3ec564ea51616fceb6facb37709313e15fb8b7d6) Thanks [@dfadler](https://github.com/dfadler)! - Decode Mermaid entity codes (`#quot;`, `[#35](https://github.com/dfadler/zombie-mermaid/issues/35);`) in pie and xychart titles, slice labels, axis titles and categories.

- [#1620](https://github.com/dfadler/zombie-mermaid/pull/1620) [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931) Thanks [@dfadler](https://github.com/dfadler)! - Fix package README inaccuracies and add missing `package.json` metadata ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).
- Updated dependencies [[`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931)]:
  - @zombie-mermaid/core@5.1.0

## 5.0.1

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@5.0.1

## 5.0.0

### Major Changes

- [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444) [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1) Thanks [@dfadler](https://github.com/dfadler)! - **BREAKING:** `elkjs` is now an optional peer dependency of `@zombie-mermaid/svg-renderer` (and no longer a dependency of `@zombie-mermaid/core`), and the library no longer imports it. Browser and bundler apps that render flowchart, state, class, ER or architecture diagrams must `npm install elkjs` and call the new `registerElk(ELK)` once (`import ELK from 'elkjs/lib/elk.bundled.js'`); otherwise rendering those diagrams throws `ElkNotRegisteredError`. Under Node and Bun, `elkjs` is auto-loaded when installed, and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so the CLI and MCP server need no change. Sequence, pie, xychart, C4 and ASCII output never needed it. In exchange, the SVG renderer's browser bundle drops from about 518 KB to 74 KB gzipped (umbrella 576 KB to 130 KB) when elk is not registered, and the published `.d.ts` files no longer import from `elkjs` (the `Elk*` graph types are now exported by `@zombie-mermaid/core`). See `docs/guides/elkjs-optional-peer.md`.

### Patch Changes

- [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3) Thanks [@dfadler](https://github.com/dfadler)! - Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop the unused `entities` dependency declaration from mcp (refs [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426)).
- Updated dependencies [[`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1), [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3)]:
  - @zombie-mermaid/core@5.0.0

## 4.2.3

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@4.2.3

## 4.2.2

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/core@4.2.2

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
