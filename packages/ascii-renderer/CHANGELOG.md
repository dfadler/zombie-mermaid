# @zombie-mermaid/ascii-renderer

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
