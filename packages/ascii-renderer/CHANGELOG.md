# @zombie-mermaid/ascii-renderer

## 4.2.3

### Patch Changes

- [#1419](https://github.com/dfadler/zombie-mermaid/pull/1419) [`3cfd4c0`](https://github.com/dfadler/zombie-mermaid/commit/3cfd4c0d5f1cdf3dae82f4e5fd8a934f6ef8b70b) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a back edge between two nodes of the same subgraph now stays inside the subgraph's frame instead of running past its wall (fixes [#1399](https://github.com/dfadler/zombie-mermaid/issues/1399)).

- [#1407](https://github.com/dfadler/zombie-mermaid/pull/1407) [`1bfc76e`](https://github.com/dfadler/zombie-mermaid/commit/1bfc76ecd6db50b18d9d6b147863ce60fd65d2e3) Thanks [@dfadler](https://github.com/dfadler)! - Fix `renderMermaidASCII` hanging or throwing `pathCells: segment ... did not reach its endpoint` on a top-down flowchart made of chained fan-outs (`A --> B`, `A --> C`, `C --> D`, `D --> E`, `D --> F`, ...). A parent whose children sat a half column apart was placed on a fractional column; it now stays above its first child instead. Closes [#1391](https://github.com/dfadler/zombie-mermaid/issues/1391).

- [#1416](https://github.com/dfadler/zombie-mermaid/pull/1416) [`cfa74cd`](https://github.com/dfadler/zombie-mermaid/commit/cfa74cded88f56b88f228f0f886d5d83689e7eff) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a vertical edge's label is drawn on its stroke at the gap midpoint, centred on the line the way Mermaid does, with the stroke carrying on above and below the text. A gap too short for that, or cells already taken, keep the previous placement (refs [#1408](https://github.com/dfadler/zombie-mermaid/issues/1408), option C).

- [#1404](https://github.com/dfadler/zombie-mermaid/pull/1404) [`1f524f8`](https://github.com/dfadler/zombie-mermaid/commit/1f524f8cb074eca81b2c9aedd0bb51788356f48a) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: with `paddingX` 1 or 2, an `LR` node with several parents no longer has one parent's edge stop beside its border with no junction or arrowhead; the gap before such a node is kept at least 3 wide so the edges join (fixes [#1393](https://github.com/dfadler/zombie-mermaid/issues/1393)).

- [#1422](https://github.com/dfadler/zombie-mermaid/pull/1422) [`555cbfb`](https://github.com/dfadler/zombie-mermaid/commit/555cbfbe627df56261d2191a0e3b7286e4d33f0d) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: an edge whose conflict-avoiding reroute finds no clear route keeps its earlier path instead of falling back to a straight line drawn through another node (fixes [#1411](https://github.com/dfadler/zombie-mermaid/issues/1411)).

- [#1410](https://github.com/dfadler/zombie-mermaid/pull/1410) [`2a29580`](https://github.com/dfadler/zombie-mermaid/commit/2a295809f975afe7a1f9c00a5f45c46c03d2cc93) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII flowcharts where two labeled edges reaching the same side of a node from opposite directions (such as the two "No" edges into "Fix & Retry" in the CI/CD sample) merged into one line with a single arrowhead. Each now gets its own column and arrowhead. Closes [#1399](https://github.com/dfadler/zombie-mermaid/issues/1399).

- [#1417](https://github.com/dfadler/zombie-mermaid/pull/1417) [`c0eed80`](https://github.com/dfadler/zombie-mermaid/commit/c0eed80f2abe099733b169ef7a2f348077a2e903) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII diagrams where the down and up strokes of a reciprocal pair on one node side (such as Busy and Err in the state-diagram samples) ran only one blank cell apart and read as one edge. They now keep a clear gap where the node border has room. Closes [#1400](https://github.com/dfadler/zombie-mermaid/issues/1400).

- [#1427](https://github.com/dfadler/zombie-mermaid/pull/1427) [`a637027`](https://github.com/dfadler/zombie-mermaid/commit/a6370270f9afed0a4e4cdfac6c40a08468344e6b) Thanks [@dfadler](https://github.com/dfadler)! - Stop publishing test files in the npm tarballs (the `zombie-mermaid` tarball drops from about 255 KB to 46 KB), and speed up ASCII edge routing by about 25% on large flowcharts with no change to output. Refs [#1373](https://github.com/dfadler/zombie-mermaid/issues/1373), [#1374](https://github.com/dfadler/zombie-mermaid/issues/1374).
- Updated dependencies []:
  - @zombie-mermaid/core@4.2.3
  - @zombie-mermaid/mermaid-parser@4.2.3

## 4.2.2

### Patch Changes

- [#1389](https://github.com/dfadler/zombie-mermaid/pull/1389) [`b4091ce`](https://github.com/dfadler/zombie-mermaid/commit/b4091ce0c90c3ea3b5bd1bdf0d2471f22ec1f1f9) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII sequence diagrams where a self-message label (including multi-line `<br/>` labels) was drawn over the next participant's lifeline and erased it. The label now sits above the loop, as mermaid.js draws it, and the gap to the next participant widens only as far as the label needs. Closes [#1387](https://github.com/dfadler/zombie-mermaid/issues/1387).
- Updated dependencies []:
  - @zombie-mermaid/core@4.2.2
  - @zombie-mermaid/mermaid-parser@4.2.2

## 4.2.1

### Patch Changes

- [#1381](https://github.com/dfadler/zombie-mermaid/pull/1381) [`245e76b`](https://github.com/dfadler/zombie-mermaid/commit/245e76b8c32e4e3234414d68a8bfb7de522f8cc4) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts in ASCII output: neighbouring bar segments now keep their different fills (`█▓▒░`, or `#=*+` with `useAscii`) in every colour mode, not only with `colorMode: 'none'`, with the colour painted on top. Before, colour modes drew every segment as a solid block, so two neighbours whose palette shades mapped to the same terminal colour (common in `ansi16`, for example two slices either side of a zero-value slice) merged into one run. Also, with more than 50 slices at 1% or more, a slice that ends up with no cell in the 50-cell bar is now shown like a slice under 1% (a `·` swatch and no percentage) instead of with a fill swatch and a percentage for a segment that isn't there.
- Updated dependencies []:
  - @zombie-mermaid/core@4.2.1
  - @zombie-mermaid/mermaid-parser@4.2.1

## 4.2.0

### Minor Changes

- [#1377](https://github.com/dfadler/zombie-mermaid/pull/1377) [`d1e8208`](https://github.com/dfadler/zombie-mermaid/commit/d1e8208919305e90d377783e8975da05fd0f214b) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 3: ASCII rendering. `renderMermaidASCII` now renders `pie` charts. Mermaid has no text mode for pie charts, so the output is a stacked bar 50 cells wide plus a table, with the SVG renderer's numbers: slices in source order; whole-number percentages of the full total; slices under 1% of the total (and zero-value slices) left out of the bar but kept in the table, without a percentage; `label [value]` rows under `showData`, the value printed as written; the title centred over the bar; an empty bar for a chart with no slices. Bar cells are rounded by largest remainder so the segments always fill exactly 50 cells, and every drawn slice gets at least one. Colours use the SVG palette (the theme accent, then the XY chart series shades, repeating after 12) in every colour mode; with `colorMode: 'none'` neighbouring segments get different fills (`█▓▒░`, or `#=*+` with `useAscii`) so they stay distinguishable. Labels are never truncated, and wide (CJK/emoji) labels are aligned by terminal width. `accTitle`/`accDescr` are not printed. Based on the stacked-bar design in [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.

### Patch Changes

- [#1356](https://github.com/dfadler/zombie-mermaid/pull/1356) [`6f4b53a`](https://github.com/dfadler/zombie-mermaid/commit/6f4b53a8b5610cf09025b32983d53dc3d7ac3aa9) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a back edge that has to go round a node is now one clean loop instead of a staircase with an extra jog. A rerouted edge prefers fewest bends in every graph (it did so only with cluster exits), two edges that meet at one node port and turn at different corners no longer force each other round the diagram, and a long label on a short hop no longer widens a node's own border column and inflates its box ([#1349](https://github.com/dfadler/zombie-mermaid/issues/1349)).

- [#1342](https://github.com/dfadler/zombie-mermaid/pull/1342) [`c12701b`](https://github.com/dfadler/zombie-mermaid/commit/c12701bef5199ce826bf94d6752f48a641be104a) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a label placed beside a vertical stroke now also stays clear of every other edge's label, not just nodes, subgraphs and edge paths; when its cells are taken it falls back to the stroke as before ([#1338](https://github.com/dfadler/zombie-mermaid/issues/1338)).

- [#1352](https://github.com/dfadler/zombie-mermaid/pull/1352) [`907dfd8`](https://github.com/dfadler/zombie-mermaid/commit/907dfd82a8f28ca97d800dbfd9578d77bd6a3e92) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: when two or more edges leave a subgraph, each now starts at its own tee on the frame's wall, nearest its target and in target order, instead of all sharing one exit cell. A wall too narrow to give every exit its own cell keeps the shared tee ([#1182](https://github.com/dfadler/zombie-mermaid/issues/1182)).

- [#1341](https://github.com/dfadler/zombie-mermaid/pull/1341) [`d08774b`](https://github.com/dfadler/zombie-mermaid/commit/d08774b6bc50febc270517f590b647e945fdb832) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: edges leaving a subgraph (`S --> T`, two or more exits) now start on the frame's own wall, as a tee on the wall, instead of on the border of the node inside it, so the arrow reads as leaving the subgraph and the inner node's border stays unbroken ([#1330](https://github.com/dfadler/zombie-mermaid/issues/1330)).

- [#1346](https://github.com/dfadler/zombie-mermaid/pull/1346) [`9ef5170`](https://github.com/dfadler/zombie-mermaid/commit/9ef5170e2d182e178d278f9babff4f16dc955bcf) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a plain node fed by several parents (`X --> A; Y --> A`) now sits centered between them, as in Mermaid, instead of under the first parent with the other edges running in from the side. It applies when the edges bundle into one trunk (labeled TD fan-in is handled separately); a parent that also feeds another node and a node that fans out itself keep their previous placement (part of [#1339](https://github.com/dfadler/zombie-mermaid/issues/1339)). In `LR`/`RL` each parent leaves through its right (left) face and joins in the gap before the child, with no padding added to the neighbouring rows.

- [#1365](https://github.com/dfadler/zombie-mermaid/pull/1365) [`163971e`](https://github.com/dfadler/zombie-mermaid/commit/163971e94e0a82d8b9b083b10b80883a74b8ad9e) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: edges that leave one node port in the same direction and bend the same way at different distances (for example `develop` to `feature/ui` and `release/1.0` in the git branching sample) now each leave by a stem of their own, one stroke spacing apart, instead of the nearer bend riding the whole stem of the farther one. Edges that bend at the same distance or the other way still share one trunk, and a node border too narrow for every stem keeps the shared trunk ([#1308](https://github.com/dfadler/zombie-mermaid/issues/1308)).

- [#1358](https://github.com/dfadler/zombie-mermaid/pull/1358) [`e8c1a17`](https://github.com/dfadler/zombie-mermaid/commit/e8c1a17611c522c67bf3c1a2b2b407ef4e245208) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: an edge label now reads as belonging to its own edge. A label on a corner shared by two shifted port runs is moved to the row its stroke is drawn on instead of the row between two strokes, and a label beside a vertical stroke slides along it to a row clear of other edges' strokes so it is not mistaken for theirs.

- [#1353](https://github.com/dfadler/zombie-mermaid/pull/1353) [`85b1a50`](https://github.com/dfadler/zombie-mermaid/commit/85b1a50bad3ab93348e65469a5b343ac0a1683b5) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: an edge label is now chosen once every edge is routed, so it avoids a segment another edge also runs along and a segment another label already holds (a hidden or misattributed label, [#1347](https://github.com/dfadler/zombie-mermaid/issues/1347)). An edge that arrives at a node's side port is also drawn on its own row, apart from an edge leaving the same side, as already done for top and bottom ports.

- [#1354](https://github.com/dfadler/zombie-mermaid/pull/1354) [`3e73862`](https://github.com/dfadler/zombie-mermaid/commit/3e73862ebe6b9a72532efc360df773b1818ceca2) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a space inside an edge label is no longer replaced by the stroke the label sits on, so `long label` is drawn as `long label` rather than `long─label` ([#1348](https://github.com/dfadler/zombie-mermaid/issues/1348)).

- [#1344](https://github.com/dfadler/zombie-mermaid/pull/1344) [`571a164`](https://github.com/dfadler/zombie-mermaid/commit/571a164cce7189a1bdf5aeabd8c3a0131d999c0f) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in top-down flowcharts, a node fed by several labeled edges is now centred between its parents, as in Mermaid, instead of sitting under the first one. Each parent drops down its own column and enters the node through its side, so every label keeps a stroke of its own. This also stops one label from vanishing when three or more labeled edges meet at a node. The node stays under the first parent in left-to-right graphs, when a parent also feeds another node, and when the node is on a cycle.

- [#1345](https://github.com/dfadler/zombie-mermaid/pull/1345) [`b969f18`](https://github.com/dfadler/zombie-mermaid/commit/b969f185961dff1dc695516676b57db110bdf6c5) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: nodes are now ranked by longest path, as mermaid (dagre) does. A node reachable from several parents sits below the deepest one instead of beside the first parent that placed it, so `A --> B --> D` plus `A --> D` no longer puts D in B's row; back edges are ignored when ranking, and a child is no longer placed left of its parent when slots on its level are empty.

- [#1351](https://github.com/dfadler/zombie-mermaid/pull/1351) [`57105eb`](https://github.com/dfadler/zombie-mermaid/commit/57105eb7412473e1270503b78498aa508a76e7d8) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: an edge that arrives at a node port another edge leaves from (or the reverse) is now drawn in its own column instead of piled into one corridor, so a back edge into a node no longer shares a stroke with the edges leaving it. Edges that share a port in the same direction (fan-out, fan-in, bundles) keep their shared trunk ([#1350](https://github.com/dfadler/zombie-mermaid/issues/1350)).

- [#1355](https://github.com/dfadler/zombie-mermaid/pull/1355) [`cf496ab`](https://github.com/dfadler/zombie-mermaid/commit/cf496ab5bb0ceb39f7399364ac09a07787855e5e) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: the return edge of a reciprocal pair (`A --> C` with `C --> A`) is no longer routed as a long detour round the far side of the diagram. When both routes are a straight line or a single bend, the pair may share grid cells, because the strokes are already drawn apart at their ports; the chain-overlap rule that forced the second edge around the first now applies to such a pair only when its routes are longer ([#1349](https://github.com/dfadler/zombie-mermaid/issues/1349)).

- [#1368](https://github.com/dfadler/zombie-mermaid/pull/1368) [`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2) Thanks [@dfadler](https://github.com/dfadler)! - Flowchart and state labels now decode Mermaid's entity codes (`#quot;`, `#lt;`, `#gt;`, `[#35](https://github.com/dfadler/zombie-mermaid/issues/35);`, `#x5B;`) instead of printing them literally, and ASCII output decodes `&quot;`/`&lt;`-style entities in labels as SVG already did. Decoding runs per label after parsing, ignores out-of-range code points, and never touches style lines. Idea from [lukilabs/beautiful-mermaid#158](https://github.com/lukilabs/beautiful-mermaid/pull/158) by thiccyoda.

- [#1371](https://github.com/dfadler/zombie-mermaid/pull/1371) [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 1: parsing and detection. `DiagramType` gains `'pie'`, and `detectDiagramType` routes a `pie` header to it (case-sensitively, as Mermaid does). `@zombie-mermaid/mermaid-parser` adds `parsePieChart` with the `PieChart`/`PieSlice` types (title, accTitle, accDescr, showData, slices in source order). The parser accepts and rejects the same input as Mermaid's own pie grammar: labels must be quoted, negative values are errors, zero is allowed, a repeated label keeps its first value, `showData` is only valid on the header line, and a bare `pie` with no slices is valid. `renderMermaidSVG` and `renderMermaidASCII` route a pie chart to the pie parser (so syntax errors are reported with their line) instead of misrouting it to the flowchart parser; the rendering itself is covered by the separate pie SVG and ASCII renderer changesets. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with strictness ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.
- Updated dependencies [[`700b97b`](https://github.com/dfadler/zombie-mermaid/commit/700b97bcbf5adeec39a438e7257fff71deff6fb6), [`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2), [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7), [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64)]:
  - @zombie-mermaid/mermaid-parser@4.2.0
  - @zombie-mermaid/core@4.2.0

## 4.1.0

### Patch Changes

- [#1340](https://github.com/dfadler/zombie-mermaid/pull/1340) [`ab5ff8f`](https://github.com/dfadler/zombie-mermaid/commit/ab5ff8f6a8000963db021b6a851b6abaea5939d8) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in top-down flowcharts and state diagrams, a node that fans out to several children is now centred over them, as in Mermaid, instead of sitting above the first child. Its edges leave from the middle rather than sideways and back down. It applies to acyclic graphs outside subgraphs, and the node stays put when a child has another parent or centring would widen unrelated branches.

- [#1337](https://github.com/dfadler/zombie-mermaid/pull/1337) [`c392d1a`](https://github.com/dfadler/zombie-mermaid/commit/c392d1a0535dfdc11465114aa1a2c77397fd7c9b) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a subgraph fed by several sources now sits centered between them (as mermaid.js lays it out) instead of under the first one, and its entry arrowheads are spread about the cluster's middle rather than bunched on one side.

- [#1335](https://github.com/dfadler/zombie-mermaid/pull/1335) [`ca51046`](https://github.com/dfadler/zombie-mermaid/commit/ca51046c8bc541c1442d7f9551fa9413137b40d0) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: edges addressed to one subgraph (`X --> Sub`, `Y --> Sub`) that used to merge into a single arrowhead on the frame's wall now each get an arrowhead of their own, spread along the wall, as mermaid draws them. Entries that already landed apart, and walls too narrow to separate them, are unchanged.

- [#1328](https://github.com/dfadler/zombie-mermaid/pull/1328) [`0b2b607`](https://github.com/dfadler/zombie-mermaid/commit/0b2b6075769376cb9909e906591e1ec94eb6edad) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: when two or more edges are addressed to one subgraph (`X --> Sub`, `Y --> Sub`), a source that sits off the landing column now turns onto the frame's wall and its arrowhead points into the cluster, instead of ending in a sideways arrowhead (`◄`, `▲`) that overwrote its sibling's ([#1181](https://github.com/dfadler/zombie-mermaid/issues/1181)).

- [#1322](https://github.com/dfadler/zombie-mermaid/pull/1322) [`490de7c`](https://github.com/dfadler/zombie-mermaid/commit/490de7c7d3a0d8074bed3e68c052effd91914016) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: an edge between a node and the subgraph that contains it (`B --> Sub` with `B` inside `Sub`) no longer loops along the frame wall; it is dropped ([#1310](https://github.com/dfadler/zombie-mermaid/issues/1310)).

- [#1332](https://github.com/dfadler/zombie-mermaid/pull/1332) [`9be4d36`](https://github.com/dfadler/zombie-mermaid/commit/9be4d3692fee826d22b997a4aa5289fadbc8e8bb) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: every labelled vertical edge now puts its label beside the stroke (down edges to the right, up edges to the left) instead of printing it over the line, when the cells there are free; otherwise the label stays on the stroke as before ([#1284](https://github.com/dfadler/zombie-mermaid/issues/1284)).

- [#1327](https://github.com/dfadler/zombie-mermaid/pull/1327) [`42e2e0c`](https://github.com/dfadler/zombie-mermaid/commit/42e2e0c576bb61f0bd193977c74d3bc045825d14) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: the two edges of a vertical reciprocal pair (`A -->|x| B` with `B -->|y| A`) are drawn as two strokes one cell either side of the column centre, each label beside its own stroke, instead of sharing one stroke that the labels cut ([#1284](https://github.com/dfadler/zombie-mermaid/issues/1284)).

- [#1329](https://github.com/dfadler/zombie-mermaid/pull/1329) [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36) Thanks [@dfadler](https://github.com/dfadler)! - SVG: an edge between a node and a subgraph that contains it (`B --> Sub` with `B` inside `Sub`, or `Sub --> B`, or between nested subgraphs) is no longer drawn as a degenerate stub. Real mermaid.js 11.17.2 draws no line for it (a zero-length path), and now both renderers omit it through one shared check in `@zombie-mermaid/core` ([#1310](https://github.com/dfadler/zombie-mermaid/issues/1310)).

  SVG: the gap cut in an edge where it crosses a subgraph title ([#1239](https://github.com/dfadler/zombie-mermaid/issues/1239)) is now only cut when the edge passes through the title text itself, not when it merely runs through the 2px clearance beside it.

- Updated dependencies [[`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277), [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36)]:
  - @zombie-mermaid/core@4.1.0
  - @zombie-mermaid/mermaid-parser@4.1.0

## 4.0.0

### Patch Changes

- [#1259](https://github.com/dfadler/zombie-mermaid/pull/1259) [`9d18ee7`](https://github.com/dfadler/zombie-mermaid/commit/9d18ee79afb97e7d360e4314532126c39048280a) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts and state diagrams: `RL` direction now flows right to left (the source node on the right, arrowheads pointing left), mirroring the `LR` layout, instead of being drawn identically to `LR`. Labels and subgraph titles keep reading left to right. Closes [#1231](https://github.com/dfadler/zombie-mermaid/issues/1231).

- [#1301](https://github.com/dfadler/zombie-mermaid/pull/1301) [`f6eb9e2`](https://github.com/dfadler/zombie-mermaid/commit/f6eb9e258aa7a51b3155e31e67b2fa712eca9916) Thanks [@dfadler](https://github.com/dfadler)! - ASCII subgraph frames: when a non-member node is moved off a frame, a free-standing parent that only feeds it moves to the same column (row in LR), so `W --> Y` drops straight down instead of wrapping around from W's side.

- [#1273](https://github.com/dfadler/zombie-mermaid/pull/1273) [`d1d1ca4`](https://github.com/dfadler/zombie-mermaid/commit/d1d1ca4a3ecc68a41769e0911c98ddca60c90de1) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: the second parallel edge between two nodes no longer draws a stray arrowhead and junction on the target's border. It now runs down (top-down graphs) or under (left-right graphs) the nodes and enters the target's side face with its own arrowhead.

- [#1300](https://github.com/dfadler/zombie-mermaid/pull/1300) [`4b2e887`](https://github.com/dfadler/zombie-mermaid/commit/4b2e887d6329e6923468a9e7baf80d327fb82891) Thanks [@dfadler](https://github.com/dfadler)! - ASCII subgraphs in a stacked layout: a back edge running beside a frame now keeps a clear column from the wall instead of running against it, and a title widened for an entering stroke keeps a clear column before the right wall. Closes [#1285](https://github.com/dfadler/zombie-mermaid/issues/1285).

- [#1304](https://github.com/dfadler/zombie-mermaid/pull/1304) [`bcdf5aa`](https://github.com/dfadler/zombie-mermaid/commit/bcdf5aa2aca2ed79d3f92fa3fae37ad75b152f23) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: an edge addressed to a subgraph id (`Y --> Sub`) now ends at the frame's wall instead of crossing it and ending on a member inside, and the subgraph is placed past the sources of such edges, so `W --> Y --> Sub` no longer lands Y beside the frame with a sideways edge across its wall.

- [#1278](https://github.com/dfadler/zombie-mermaid/pull/1278) [`bddc87f`](https://github.com/dfadler/zombie-mermaid/commit/bddc87f2bf9a7e82b3fa33d6a7cd245dfb60639b) Thanks [@dfadler](https://github.com/dfadler)! - ASCII subgraph frames: an edge entering a titled frame no longer splits the title (`Layer│Two`); the frame widens so the title sits beside the edge. A node that is not a member of a subgraph is no longer drawn inside its frame. An edge label no longer overwrites a letter of a frame title, and a frame is widened rather than clipping a title wider than its nodes (`Layer T`).

- [#1302](https://github.com/dfadler/zombie-mermaid/pull/1302) [`02b9efb`](https://github.com/dfadler/zombie-mermaid/commit/02b9efba372f288c6f3670fcc69fb11e76015f0a) Thanks [@dfadler](https://github.com/dfadler)! - In ASCII output, a subgraph wall that gets pushed outward by an edge no longer lands on its node's box, so the edge joins the wall cleanly instead of colliding with the node border.

- [#1303](https://github.com/dfadler/zombie-mermaid/pull/1303) [`618923e`](https://github.com/dfadler/zombie-mermaid/commit/618923e0f51503bff2ba79cae91ddabf2283b035) Thanks [@dfadler](https://github.com/dfadler)! - Class diagram ASCII output now draws `namespace Name { ... }` blocks as a titled frame around their member classes. Members of a namespace are kept next to each other in their row, a relationship crossing a frame keeps its stroke, and the title slides clear of it.
- Updated dependencies [[`20db743`](https://github.com/dfadler/zombie-mermaid/commit/20db743be4508a59d57bfe81a97fb916910b2a54), [`c7d9704`](https://github.com/dfadler/zombie-mermaid/commit/c7d9704c9cbc9f39d3408a0d4cac124e2e1852dc), [`89e915f`](https://github.com/dfadler/zombie-mermaid/commit/89e915ff838a140dbac4bc6452e4460cf766693c), [`7e4db32`](https://github.com/dfadler/zombie-mermaid/commit/7e4db3206ab61740b54f427003ab3fb248001d66)]:
  - @zombie-mermaid/mermaid-parser@4.0.0
  - @zombie-mermaid/core@4.0.0

## 3.2.0

### Minor Changes

- [#1195](https://github.com/dfadler/zombie-mermaid/pull/1195) [`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9) Thanks [@dfadler](https://github.com/dfadler)! - Add `architecture-beta` diagrams (Mermaid's native syntax: `group`, `service`, `junction`, port-sided edges, `{group}` edges). They are lowered to the flowchart model and render in SVG and ASCII; ports steer flow direction rather than an exact grid, and icons are not drawn. `DIAGRAM_TYPES` gains `'architecture'`.

- [#1192](https://github.com/dfadler/zombie-mermaid/pull/1192) [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1) Thanks [@dfadler](https://github.com/dfadler)! - Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII with dedicated renderers. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, which records `Rel_U/D/L/R` placement hints. The SVG renderer lays out with ELK (nested boundaries, relationships to boundaries) and draws a person glyph, cylinders, queues, the C4 palette, boundary frames, a title, and relationship labels with a separate `[technology]` line. The ASCII renderer has its own row layout, boxes, boundary frames, and grid router. `Rel_D`/`Rel_U` steer layering; `Rel_R`/`Rel_L` place elements side by side (exact in ASCII, a best-effort nudge in SVG). Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (devx), both unmerged upstream; nothing was copied from either renderer; the parser and integration fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (adapted, with known gaps marked as skipped). ArchiMate remains open under [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167).

### Patch Changes

- [#1187](https://github.com/dfadler/zombie-mermaid/pull/1187) [`84f70d4`](https://github.com/dfadler/zombie-mermaid/commit/84f70d4f72c8f6951c14ba5ec795247e12cca383) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts and state diagrams: when two or more edges leave a subgraph (or composite state) to differently-placed targets, they now all cross the cluster's own flow-side wall through one shared trunk and fan out below it, instead of some edges leaving through the side of the inner node that stands in for the cluster. Labels no longer overwrite the cluster border. Single-exit clusters render exactly as before. Closes [#1135](https://github.com/dfadler/zombie-mermaid/issues/1135), [#1148](https://github.com/dfadler/zombie-mermaid/issues/1148), [#1156](https://github.com/dfadler/zombie-mermaid/issues/1156).

- [#1224](https://github.com/dfadler/zombie-mermaid/pull/1224) [`ad28261`](https://github.com/dfadler/zombie-mermaid/commit/ad282610307f63bf8782e08534a4a127c6afaacd) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts and state diagrams: a subgraph (or composite state) with two edges to the same target (parallel lanes) plus other exits now routes all of them through the cluster's shared exit trunk. The second lane enters the target through a side face instead of running along its border, and each exit's label sits on its own leg. Before, one extra exit punched through the cluster wall, and with two extra exits the second lane left through the side wall with both lane labels on the wall row. Refs [#1182](https://github.com/dfadler/zombie-mermaid/issues/1182).

- [#1221](https://github.com/dfadler/zombie-mermaid/pull/1221) [`7e43e46`](https://github.com/dfadler/zombie-mermaid/commit/7e43e46f12cf90680d8dde7df147e73527108462) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: when nested subgraphs both have multiple exits, the outer subgraph's exit trunk is now measured after the inner subgraph's gutter widening has shifted the outer wall, so the outer exits no longer fan out of the wall column itself. Closes [#1213](https://github.com/dfadler/zombie-mermaid/issues/1213).

- [#1214](https://github.com/dfadler/zombie-mermaid/pull/1214) [`d3f0524`](https://github.com/dfadler/zombie-mermaid/commit/d3f052484f932e902e2c0d64be9621a56a9f17e7) Thanks [@dfadler](https://github.com/dfadler)! - `colorMode: 'html'` output no longer shows hairline seams inside solid bars (XY chart bars and other `█` fills) on displays scaled to a fractional size such as 125% or 150%. A run made only of full blocks now also gets a background of its own color, so the browser's anti-aliased glyph edges land on a solid fill instead of compositing to 75-81% brightness at every cell boundary. Other spans, half blocks, and the ANSI color modes are unchanged.

- [#1222](https://github.com/dfadler/zombie-mermaid/pull/1222) [`77f88b0`](https://github.com/dfadler/zombie-mermaid/commit/77f88b0a3d4fc44942deb6686d726b36435e5d6d) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts and architecture diagrams: a cycle whose edges cross between sibling subgraphs (e.g. `A --> C --> E --> A` with each node in its own subgraph) no longer throws `Node "A" has no gridCoord`. Closes [#1197](https://github.com/dfadler/zombie-mermaid/issues/1197).
  Such a back-edge now routes outside the frames it only passes (instead of up through their interiors and titles). Frames are not tracked in the routing grid, so the edge's route reserves the unrelated frames' cells and the gap is widened to clear each frame wall.
  A forward edge entering a titled frame now stays continuous through the title row: the title slides aside (one clear column), or splits on a space ("Layer│Three"), instead of covering the edge. Where neither is possible without dropping a letter the title still wins. Refs [#1222](https://github.com/dfadler/zombie-mermaid/issues/1222).
  When a title fills its frame and the entering edge would land on a letter, the frame is widened by the fewest columns (up to 4) so the title splits on a space instead; frames without such a collision keep their size.

- [#1200](https://github.com/dfadler/zombie-mermaid/pull/1200) [`502b06b`](https://github.com/dfadler/zombie-mermaid/commit/502b06b111f8d3379287322e5b061585b7fc82e5) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts with `direction: BT` (and diagrams lowered to flowcharts) no longer reverse the line order of multi-line node and edge labels, no longer rewrite `v`/`^` characters inside labels into arrowheads, and now flip rounded corners (rounded rectangles, cylinder caps) correctly.

- [#1203](https://github.com/dfadler/zombie-mermaid/pull/1203) [`b742dca`](https://github.com/dfadler/zombie-mermaid/commit/b742dcaf14c5d4d03346a58c1bf4842b745a5279) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts with `direction: BT` now keep multi-line node labels intact when a line is blank or shorter than its neighbour (a blank line no longer swaps the paragraphs around it, and a wide first line is no longer split across rows), and a `-` or `|` inside a node label is no longer left behind when the label moves.

- [#1245](https://github.com/dfadler/zombie-mermaid/pull/1245) [`b88c5bc`](https://github.com/dfadler/zombie-mermaid/commit/b88c5bc2e28cff949282516984fba9d47bb46416) Thanks [@dfadler](https://github.com/dfadler)! - Fix XY chart value-axis tick labels repeating when the data range is narrow. Labels now take their precision from the tick step instead of rounding to whole numbers above 10, so a 99-102 range reads `99, 99.5, 100, ...` and a single value no longer shows the same number at every tick.
- Updated dependencies [[`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9), [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1), [`54432b6`](https://github.com/dfadler/zombie-mermaid/commit/54432b6206c1af5d2e2d4fdd447256d9bbbcc85b), [`f01ed87`](https://github.com/dfadler/zombie-mermaid/commit/f01ed8761b156c33d88a3b9fb9bc21c805675085)]:
  - @zombie-mermaid/core@3.2.0
  - @zombie-mermaid/mermaid-parser@3.2.0

## 3.1.0

### Patch Changes

- Updated dependencies [[`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e), [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34)]:
  - @zombie-mermaid/core@3.1.0
  - @zombie-mermaid/mermaid-parser@3.1.0

## 3.0.0

### Patch Changes

- [#1132](https://github.com/dfadler/zombie-mermaid/pull/1132) [`508b508`](https://github.com/dfadler/zombie-mermaid/commit/508b5083e74088b1a6163016b24cfc4c32f93ebb) Thanks [@dfadler](https://github.com/dfadler)! - Fix two ASCII structural-fidelity bugs found by the weekly form-judge audit ([#1119](https://github.com/dfadler/zombie-mermaid/issues/1119)):

  - A cylinder (database) node rendered identically to a plain rounded node — same corner glyphs, no cylinder-specific marker — because the flowchart drawing path never used the existing `cylinderRenderer`'s rim-line rendering at all; it draws every shape as a bordered rectangle with shape-specific corner glyphs only, and cylinder's corners were identical to rounded's. Cylinder nodes now get a rim line just inside the top and bottom border, using height already reserved for it.
  - An ER relationship's label could land directly beside (or, with a short label, directly inside) a _different_ relationship's already-drawn connector line, when that spot was otherwise the label's natural placement. Since the foreign line's role wasn't checked as an obstacle, the label search treated it as free space — misleadingly implying the label described that line's solid/dashed style instead of its own. The label search now also avoids a different relationship's own line, falling back to the old, permissive placement only when no row in range clears that stricter bar — so a label is relocated rather than dropped.

- [#1137](https://github.com/dfadler/zombie-mermaid/pull/1137) [`451b981`](https://github.com/dfadler/zombie-mermaid/commit/451b98195e3370eb4a3beb66071396d5c616dbad) Thanks [@dfadler](https://github.com/dfadler)! - Fix ER diagram attribute columns rendering in the wrong left-to-right order, found by the weekly form-judge audit ([#1119](https://github.com/dfadler/zombie-mermaid/issues/1119)). An attribute like `int id PK` rendered as `PK int id` — keys, then type, then name — while real mermaid's SVG lays these columns out as type, name, then keys. Attribute lines now render as `int id PK`, matching that order; a keyless attribute also no longer reserves unused padding for an empty key column.

- [#1136](https://github.com/dfadler/zombie-mermaid/pull/1136) [`0849aba`](https://github.com/dfadler/zombie-mermaid/commit/0849abafc62e6cd94e38318e9edf6fe27634b49a) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII sequence diagrams not rendering activation bars. A lifeline now switches to a double-line glyph (`║`, or `‖` in `useAscii` mode) for the rows where that participant is actively processing a call — driven by `activate`/`deactivate` statements or the `+`/`-` arrow shorthand — instead of drawing a uniform `│` for its full span regardless of activation state.

- [#1153](https://github.com/dfadler/zombie-mermaid/pull/1153) [`28698cd`](https://github.com/dfadler/zombie-mermaid/commit/28698cd7d706bb429f56edc0d38a185fde65120e) Thanks [@dfadler](https://github.com/dfadler)! - Fix ER diagram relationship lines rendering with the wrong solid/dashed style where two relationships' lines cross ([#1145](https://github.com/dfadler/zombie-mermaid/issues/1145)).

  Two relationship lines are allowed to cross in normal ER layout, but the collision guard only protected already-placed label text from being overwritten — it didn't protect an already-drawn line glyph from a _different_ relationship's differently-styled line landing on the same cell. Whichever relationship happened to be declared (and so drawn) later in the diagram won the cell outright, regardless of style, so an identifying (solid) relationship's own line could end up showing a dashed glyph purely from draw order. A dashed write can no longer overwrite an already-drawn solid glyph, so the result no longer depends on declaration order; two same-styled lines crossing are still drawn as before.

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

- [#1093](https://github.com/dfadler/zombie-mermaid/pull/1093) [`43bac5a`](https://github.com/dfadler/zombie-mermaid/commit/43bac5abfb13064623ad94042b20ca9f4251fdaf) Thanks [@dfadler](https://github.com/dfadler)! - Fix two ASCII edge-routing structural-fidelity bugs found by the weekly
  form-judge audit ([#1067](https://github.com/dfadler/zombie-mermaid/issues/1067)):

  - A same-source fan-out with mixed edge styles (e.g. `-->`, `-.->`, `==>`
    from one node) could render one edge's own line as a mix of two
    different styles where it overlapped a sibling edge's route — e.g. a
    dotted edge's horizontal leg drawing as heavy box-drawing characters
    before switching to its own dashed vertical leg. Edges' line canvases
    now resolve any leftover overlap by "first claim wins" before merging,
    and `determinePath`'s Case-4 direct-fallback path is now expanded into
    the same axis-aligned corner `drawLine` actually draws, so conflict
    detection sees the same geometry that gets rendered.
  - Two edges chained through a shared intermediate node (`A --> B` then
    `B --> C`, independently routed) could have their corners coincide and
    render as one unbroken connector straight from `A` to `C`, even with no
    direct `A --> C` edge in the source. Chain pairs that share 2+ open
    cells beyond their common node's own border are now detected and
    rerouted, the same way a cross-style conflict already was.
  - A cell overlap between two unrelated edges could be hidden by a _third_
    edge that happened to claim the same cell first, since only one owner
    per cell was tracked; cells now track every edge that claims them.
  - Two plain box-drawing edges genuinely crossing perpendicular (one
    edge's own `─`, another's own `│`) could have the second edge's
    character silently dropped instead of merging into `┼`, once "first
    claim wins" (above) started applying at the character level; it now
    only suppresses a later character when the two wouldn't otherwise form
    a meaningful crossing.
  - The canvas could be sized before a subgraph-driven drawing offset was
    known, leaving it too narrow/short to fit content shifted into that
    margin — an edge routed close enough to the diagram's far edge (as the
    chain-pair reroute above can produce) had its line silently clipped,
    leaving a disconnected corner with no line reaching its node. The
    canvas is now sized after that offset is computed, including it.

- Updated dependencies []:
  - @zombie-mermaid/core@2.2.5
  - @zombie-mermaid/mermaid-parser@2.2.5

## 2.2.1

### Patch Changes

- [#1069](https://github.com/dfadler/zombie-mermaid/pull/1069) [`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66) Thanks [@dfadler](https://github.com/dfadler)! - Fix diagonal edge-routing arrowheads (`◢◣◤◥`) falling back to an unpinned
  system font in ASCII output: JetBrains Mono NL has no glyph for them at
  all ([#1062](https://github.com/dfadler/zombie-mermaid/issues/1062)), so `drawArrowHead` now draws `↖↗↘↙` instead — real,
  correctly-directional glyphs the font does have. Also fixes an
  `isWideChar` misclassification the new glyphs would otherwise hit.

- [#1086](https://github.com/dfadler/zombie-mermaid/pull/1086) [`7b32f48`](https://github.com/dfadler/zombie-mermaid/commit/7b32f48fa2a9488b66a94bdd43ad4be134d74349) Thanks [@dfadler](https://github.com/dfadler)! - Fix a bogus diagonal arrowhead (`↘`) on the last edge in a mixed-style
  fan-out (e.g. solid/dotted/thick siblings from the same source), even
  when that edge's line was perfectly vertical ([#1083](https://github.com/dfadler/zombie-mermaid/issues/1083)). The edge's route
  had fallen through to `determinePath`'s Case-4 direct fallback, which
  `draw-lines.ts` draws as an L-shaped path (horizontal run, then vertical
  run) folded into one segment; `drawArrowHead` derived direction from that
  segment's first and last point, spanning both legs and reading as
  diagonal. It now derives direction from the final step into the
  arrowhead instead.
- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66), [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043)]:
  - @zombie-mermaid/core@2.2.1
  - @zombie-mermaid/mermaid-parser@2.2.1
