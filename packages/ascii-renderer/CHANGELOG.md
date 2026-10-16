# @zombie-mermaid/ascii-renderer

## 5.7.1

### Patch Changes

- [#2149](https://github.com/dfadler/zombie-mermaid/pull/2149) [`8a8c482`](https://github.com/dfadler/zombie-mermaid/commit/8a8c482cd45570fb76c7757986236d1170b0d301) Thanks [@dfadler](https://github.com/dfadler)! - fix(ascii): give every edge into a crowded top face a stroke and an arrowhead of its own ([#2100](https://github.com/dfadler/zombie-mermaid/issues/2100)). Output change: in a TD/BT flowchart, a node that takes edges from two or more sources above it and also sends an edge up to a node above it (`a --> c`, `b --> c` beside `c --> a`) no longer bundles those arrivals onto one trunk with one shared arrowhead. The node is widened so each end has a cell, the reciprocal pair sits either side of the centre, and the other arrivals land beyond them. A fan-out into such a node is split too, so `b --> a` and `b --> c` leave `b` on their own strokes. Fan-ins with labels that land on a port which also starts an edge now keep one arrowhead each instead of merging. Duplicate (parallel) edges, LR/RL layouts and every other gallery sample and golden are unchanged. Self-loop placement (left face in mermaid TD/BT, top face in LR/RL) is a documented difference ([#2101](https://github.com/dfadler/zombie-mermaid/issues/2101)). Checked against mermaid 12.1.0 and 12.2.0.

  Versioning: patch per docs/decisions/versioning-and-deprecation-policy-1568.md section 1, "Output changes": layout, spacing and glyph changes are not documented output contracts, and this corrects merged arrowheads.

- [#2148](https://github.com/dfadler/zombie-mermaid/pull/2148) [`b55b7fa`](https://github.com/dfadler/zombie-mermaid/commit/b55b7fae2b576173e6b438094d21238119947ace) Thanks [@dfadler](https://github.com/dfadler)! - Output change: ASCII flowcharts now order sibling subgraphs and orient feedback edges the way mermaid 12 and the SVG renderer do ([#2111](https://github.com/dfadler/zombie-mermaid/issues/2111)). Sibling subgraphs tied by an edge or a shared outside node keep declaration order (Nested Subgraphs lists US East before US West), and an edge that closes a cycle through a subgraph boundary is ranked as running the other way (CI/CD puts `Fix & Retry` beside `Build Image`). Titles of frames pushed back to their natural width are rechecked against entering edges. The SVG back-edge helpers moved to `@zombie-mermaid/core` so both renderers share them. Patch, not minor: a layout fix with no documented output contract involved (versioning policy, section 1, "Output changes").

- [#2146](https://github.com/dfadler/zombie-mermaid/pull/2146) [`d88b061`](https://github.com/dfadler/zombie-mermaid/commit/d88b0619fd0d5cd5f7e8c59abb0ad1dc2029eec1) Thanks [@dfadler](https://github.com/dfadler)! - fix(ascii): render ER attribute comments ([#2127](https://github.com/dfadler/zombie-mermaid/issues/2127)). Output change: an attribute with a comment, such as `string a PK "the key"`, now ends its row with the comment in quotes (`string a PK "the key"`), where it was dropped before. Mermaid shows the comment as a fourth column and does not wrap it; neither does this, so the entity box grows to the widest row, and a `<br>` becomes a space. Entities without comments render exactly as before. Patch because it fixes missing content and no documented output contract (accessibility, theming keys, documented options) changes (versioning policy section 1, "Output changes"). Checked against mermaid 12.1.0 and 12.2.0.
- Updated dependencies [[`b55b7fa`](https://github.com/dfadler/zombie-mermaid/commit/b55b7fae2b576173e6b438094d21238119947ace), [`f5e5454`](https://github.com/dfadler/zombie-mermaid/commit/f5e5454136070993bb1552dec3616c2750a6f15f)]:
  - @zombie-mermaid/core@5.7.1
  - @zombie-mermaid/mermaid-parser@5.7.1

## 5.7.0

### Minor Changes

- [#2126](https://github.com/dfadler/zombie-mermaid/pull/2126) [`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903) Thanks [@dfadler](https://github.com/dfadler)! - Class diagrams: the parser now accepts syntax mermaid.js accepts and it used to reject with an error: the `classDiagram-v2` header (an alias of `classDiagram`), `<|--|>` / `<|..|>` / `<-->` / `<..>` / `*--*` / `o--o` (the marker is drawn at both ends, in SVG and ASCII), lollipop interfaces `()--`, `--()` and `()--()` (a hollow circle at the end of the line: `○`, or `O` with `useAscii`), and backtick-quoted class names such as `` class `Animal Class!` `` (the backticks are not drawn). Nothing that parsed before is rejected, and no existing input renders differently except the output change below; the arrow regex is built from one table, so the error for a malformed relationship now lists the longer arrow set. `ClassRelationship.markerAt` gains `'both'` and `RelationshipType` gains `'lollipop'`. Parity checked against mermaid 12.1.0 (the pin) and 12.2.0.

  Output change: in ASCII, a directional arrowhead at the `from` end of a relationship (`A <-- B`, `A <.. B`) now points into the `from` box (`▲` under it) instead of away from it (`▼`). Fixes [#2117](https://github.com/dfadler/zombie-mermaid/issues/2117).

### Patch Changes

- [#2137](https://github.com/dfadler/zombie-mermaid/pull/2137) [`3dea4e8`](https://github.com/dfadler/zombie-mermaid/commit/3dea4e87ad6f4f3d285368ca3d460396e51e6fba) Thanks [@dfadler](https://github.com/dfadler)! - fix(ascii): draw back-edges and forward skips on the flow-axis faces like mermaid ([#2121](https://github.com/dfadler/zombie-mermaid/issues/2121)). Output change: a flowchart edge between nodes in one column (TD/BT) or one row (LR/RL) that runs against the flow, such as `c --> a` in `a --> b --> c --> a`, or forward over a level (`a --> c` beside `a --> b --> c`) now leaves the source's top/bottom (LR: left/right) face, runs along a lane in the gutter beside the column (below the row in LR) and enters the target's opposite face, instead of looping out of the side faces (LR: the bottom faces). Ports are spread along each face, forward lanes inside back-edge lanes, and each lane's runs along a gutter row take a row of their own, so parallel back-edges nest without crossing. Nodes with such an edge grow to hold their ports a stroke spacing apart. Duplicate edges between neighbouring levels in such a column are strokes on the facing faces, so the dense duplicate-edge samples draw with no crossings. Reciprocal pairs on neighbouring levels and diagonal back-edges keep their previous shape. Checked against mermaid 12.1.0.

- [#2109](https://github.com/dfadler/zombie-mermaid/pull/2109) [`1629a93`](https://github.com/dfadler/zombie-mermaid/commit/1629a93b59f74df129350aa69985039f2cc70cda) Thanks [@dfadler](https://github.com/dfadler)! - Output change: ASCII flowcharts draw every duplicate or reciprocal edge on a lane and arrowhead of its own, as mermaid.js draws one path per edge (checked on mermaid 12.1.0 and 12.2.0). A too-short node face used to draw the later of two identical same-direction edges on its twin's route, so two edges showed as one; the node face now grows to hold every lane of every neighbour pair, and the lanes are no longer merged. Only dense graphs of duplicates between three or more nodes change (no gallery sample or golden file does), and lanes that were merged can now cross. Semver: patch, a layout fix; layout and spacing are not a documented output contract (versioning-and-deprecation-policy-1568, section 1, "Output changes"). Fixes [#2072](https://github.com/dfadler/zombie-mermaid/issues/2072).
- Updated dependencies [[`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903)]:
  - @zombie-mermaid/core@5.7.0
  - @zombie-mermaid/mermaid-parser@5.7.0

## 5.6.1

### Patch Changes

- [#2123](https://github.com/dfadler/zombie-mermaid/pull/2123) [`972abd4`](https://github.com/dfadler/zombie-mermaid/commit/972abd4fa57bb73e071f04981f32cd9da7801543) Thanks [@dfadler](https://github.com/dfadler)! - ASCII XY charts no longer run category and value-axis labels together or overwrite them with the next label. A word label that would touch its neighbour is shortened to its band with an ellipsis (`Marke…`); numbers, dates and value-axis ticks that would touch are thinned to every n-th label, always leaving at least one blank cell. Tick marks stay.
- Updated dependencies []:
  - @zombie-mermaid/core@5.6.1
  - @zombie-mermaid/mermaid-parser@5.6.1

## 5.6.0

### Patch Changes

- [#2098](https://github.com/dfadler/zombie-mermaid/pull/2098) [`0d940f6`](https://github.com/dfadler/zombie-mermaid/commit/0d940f68a55f6f6812c5a243c53b7f94bcb1ad39) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: a self-loop on a node that also has incoming and outgoing neighbours no longer runs along another edge's lane in the gutter beside its node. The gutter is widened where the loop shares cells with an edge that does not touch its node, so the loop is drawn as a stroke of its own, nested inside that edge, in all four directions. Fixes [#2070](https://github.com/dfadler/zombie-mermaid/issues/2070).
- Updated dependencies []:
  - @zombie-mermaid/core@5.6.0
  - @zombie-mermaid/mermaid-parser@5.6.0

## 5.5.0

### Minor Changes

- [#2076](https://github.com/dfadler/zombie-mermaid/pull/2076) [`b8f3e39`](https://github.com/dfadler/zombie-mermaid/commit/b8f3e39e83ee256cf80b885dd6201686d3196e6a) Thanks [@dfadler](https://github.com/dfadler)! - ASCII `erDiagram` now stacks entities top to bottom the way mermaid.js does, instead of packing them into side-by-side rows ([#1917](https://github.com/dfadler/zombie-mermaid/issues/1917)). `direction LR` and `RL` keep the side-by-side layout.

- [#2067](https://github.com/dfadler/zombie-mermaid/pull/2067) [`e21b993`](https://github.com/dfadler/zombie-mermaid/commit/e21b993aec9aa7b3c6f3e747aeb0e98bdf9ac08b) Thanks [@dfadler](https://github.com/dfadler)! - Draw the sequence `participant X@{ "type": ... }` kinds (boundary, control, entity, database, collections, queue). SVG draws Mermaid's icons and box variants with the theme's node tokens; ASCII adds a one-line marker above the label, the same in the unicode and ASCII charsets. Unknown types keep the plain box.

### Patch Changes

- [#2063](https://github.com/dfadler/zombie-mermaid/pull/2063) [`50c39dc`](https://github.com/dfadler/zombie-mermaid/commit/50c39dcbb149519e92225d464cf99e46799bed6f) Thanks [@dfadler](https://github.com/dfadler)! - ASCII class diagrams: a detour around an intermediate box now enters its target on a row above the arrowhead, so the head has a stem, and leaves a shared anchor below the straight edge's stem instead of replacing it ([#2056](https://github.com/dfadler/zombie-mermaid/issues/2056)).

- [#2040](https://github.com/dfadler/zombie-mermaid/pull/2040) [`df88acb`](https://github.com/dfadler/zombie-mermaid/commit/df88acb864e45a6876b1744385c5db863a402176) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: duplicate self-loops, and reciprocal or duplicate edges between two nodes, no longer leave a stroke that ends in blank space or a canvas of unequal line widths. A second self-loop stays off its node's corner, and a parallel-lane search that runs out of room keeps the edge's earlier route instead of a placeholder hundreds of rows out. Fixes [#2025](https://github.com/dfadler/zombie-mermaid/issues/2025), [#2028](https://github.com/dfadler/zombie-mermaid/issues/2028) and [#2030](https://github.com/dfadler/zombie-mermaid/issues/2030).

- [#2092](https://github.com/dfadler/zombie-mermaid/pull/2092) [`ffdc68e`](https://github.com/dfadler/zombie-mermaid/commit/ffdc68e2e8a19332ea8f075ca709b0e65df67814) Thanks [@dfadler](https://github.com/dfadler)! - ASCII ER: vertical cardinality markers with a zero-circle (`zero-one`, `zero-many`) now take two rows, like mermaid's own: the tick or crow's foot against the entity box, the circle on the line one row further along instead of beside it. Vertical gaps between rows grow by up to two rows in diagrams that have such a marker ([#2083](https://github.com/dfadler/zombie-mermaid/issues/2083)).

- [#2082](https://github.com/dfadler/zombie-mermaid/pull/2082) [`ec37506`](https://github.com/dfadler/zombie-mermaid/commit/ec3750657f88ec2466344e556b77d6f2a147319a) Thanks [@dfadler](https://github.com/dfadler)! - ASCII ER: `many`, `zero-many` and `zero-one` cardinality markers on a vertical edge are now drawn along the vertical axis (`╤`/`╧`, `V`/`^` in ASCII), no longer as the horizontal `╟`/`╢`/`<`/`>` glyphs beside the line ([#2081](https://github.com/dfadler/zombie-mermaid/issues/2081)).

- [#2080](https://github.com/dfadler/zombie-mermaid/pull/2080) [`242335c`](https://github.com/dfadler/zombie-mermaid/commit/242335c43afd4d50894435c49993abf69d7f017c) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: parallel edges past the three cells of a box face no longer merge at the target. A group of five or more plain lanes (and a reciprocal folded into one) lengthens the box face so each lane keeps its own arrowhead, and a group of six or seven cluster exit siblings (up to seven edges in total) spreads over both side faces of the target ([#1826](https://github.com/dfadler/zombie-mermaid/issues/1826), [#1743](https://github.com/dfadler/zombie-mermaid/issues/1743), [#1689](https://github.com/dfadler/zombie-mermaid/issues/1689)).

- [#2093](https://github.com/dfadler/zombie-mermaid/pull/2093) [`cf53ce5`](https://github.com/dfadler/zombie-mermaid/commit/cf53ce5b38fef7d10be32edd8112904deeda89c7) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts: more parallel-lane groups keep one arrowhead per edge. A top-down or bottom-up forward group and its back group between the same two nodes (for example four edges down and two back) lengthen the faces they share; a subgraph whose only exit is a group of three or more edges now uses the cluster exit lanes; and eight or more edges from one subgraph to one target give the target a longer face ([#1826](https://github.com/dfadler/zombie-mermaid/issues/1826), [#1689](https://github.com/dfadler/zombie-mermaid/issues/1689)).

- [#2062](https://github.com/dfadler/zombie-mermaid/pull/2062) [`4a29ac5`](https://github.com/dfadler/zombie-mermaid/commit/4a29ac5939409c08bf89d6fecf913cbb2719b8f2) Thanks [@dfadler](https://github.com/dfadler)! - Output change: in an LR flowchart, an edge that jumps a node on its own row (`A --> C` past `B`) now runs under the row, out of the bottom of its origin and into the bottom of its target. It used to leave the origin along the line of `A --> B` and join `B --> C` in one arrowhead before the target. A node that a jumping edge enters while another leaves it, a node with a self-loop or backwards edge, and labeled jumping edges that share an end keep the previous route. Fixes [#2043](https://github.com/dfadler/zombie-mermaid/issues/2043) and [#2044](https://github.com/dfadler/zombie-mermaid/issues/2044).
- Updated dependencies []:
  - @zombie-mermaid/core@5.5.0
  - @zombie-mermaid/mermaid-parser@5.5.0

## 5.4.0

### Minor Changes

- [#2048](https://github.com/dfadler/zombie-mermaid/pull/2048) [`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d) Thanks [@dfadler](https://github.com/dfadler)! - Support Mermaid's `accTitle:` / `accDescr:` (single-line and `accDescr { ... }`) on every diagram type, not just pie. In SVG, `accTitle` names the root (the `title` option still wins) and `accDescr` becomes `<desc>` with `aria-describedby`; both go through the one `svgOpenTag()`. ASCII output ignores the statements and is byte-identical. New `extractAccessibility()` in `@zombie-mermaid/core`.

### Patch Changes

- [#2036](https://github.com/dfadler/zombie-mermaid/pull/2036) [`520c6b1`](https://github.com/dfadler/zombie-mermaid/commit/520c6b1ceaddbb8c3817e528b4704b88740b6ee5) Thanks [@dfadler](https://github.com/dfadler)! - ASCII C4: arrowheads are now fed by a stroke running in their direction. Routes meet each headed end straight on instead of turning on the head's own cell.

- [#2041](https://github.com/dfadler/zombie-mermaid/pull/2041) [`10f4259`](https://github.com/dfadler/zombie-mermaid/commit/10f425979fca1b6150ebc1139d5fc9bf9f3971e3) Thanks [@dfadler](https://github.com/dfadler)! - ASCII class diagrams: a relationship label no longer overwrites the horizontal run of its route, so arrowheads stay connected to their stems ([#2024](https://github.com/dfadler/zombie-mermaid/issues/2024)).

- [#2034](https://github.com/dfadler/zombie-mermaid/pull/2034) [`344431e`](https://github.com/dfadler/zombie-mermaid/commit/344431ec91d52753988a6bce3b380c394a401c33) Thanks [@dfadler](https://github.com/dfadler)! - Speed up ASCII rendering of graphs with many labelled edges (about 2.5x at 160 labelled edges), with byte-identical output: copy-on-write canvas columns no longer use the slow `slice()` of a frozen array, label segments are looked up through a per-cell index instead of rescanned, and each label's competing placements are computed once per layout.

- [#2016](https://github.com/dfadler/zombie-mermaid/pull/2016) [`0f89a9d`](https://github.com/dfadler/zombie-mermaid/commit/0f89a9db354f32fa14aa55455e28be0376d284ac) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: at a narrow `paddingX` (1 or 2), an LR edge that bypasses a same-row child now starts with a `┬` junction in the gap after its parent, instead of dropping from beside the child's arrowhead. The gap before such a child is kept 3 wide, as [#1404](https://github.com/dfadler/zombie-mermaid/issues/1404) did for fan-in children. Fixes [#1915](https://github.com/dfadler/zombie-mermaid/issues/1915).

- [#2039](https://github.com/dfadler/zombie-mermaid/pull/2039) [`b7314ed`](https://github.com/dfadler/zombie-mermaid/commit/b7314ed0e47b0392573b36d6863036e0a05d2b4d) Thanks [@dfadler](https://github.com/dfadler)! - Fix orphan line stubs in ASCII state diagrams: a side exit from a box whose border column was widened now draws its stroke all the way from the connector (State Notes), and fork/join bars fill their border rows so stems and arrowheads touch the bar.

- [#2013](https://github.com/dfadler/zombie-mermaid/pull/2013) [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8) Thanks [@dfadler](https://github.com/dfadler)! - Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in [#1596](https://github.com/dfadler/zombie-mermaid/issues/1596)) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).
- Updated dependencies [[`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d), [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8), [`adf9f32`](https://github.com/dfadler/zombie-mermaid/commit/adf9f32494a78701c37894dfcb6c4a96344b7447), [`38e2b3c`](https://github.com/dfadler/zombie-mermaid/commit/38e2b3c00efe238bb9afe8683f6758a6f23a0996)]:
  - @zombie-mermaid/core@5.4.0
  - @zombie-mermaid/mermaid-parser@5.4.0

## 5.3.0

### Minor Changes

- [#2006](https://github.com/dfadler/zombie-mermaid/pull/2006) [`8daa5ee`](https://github.com/dfadler/zombie-mermaid/commit/8daa5ee7f10ac14bf161ba48e1cd54dd0155b077) Thanks [@dfadler](https://github.com/dfadler)! - Add `profile: 'markdown'` to the ASCII renderer: ASCII-only charset and no color for output that pastes cleanly into issues, commits and fenced blocks. Explicit options still win; default output is unchanged. Closes [#1866](https://github.com/dfadler/zombie-mermaid/issues/1866).

- [#1984](https://github.com/dfadler/zombie-mermaid/pull/1984) [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a) Thanks [@dfadler](https://github.com/dfadler)! - Add `limits` to `renderMermaidSVG` and `renderMermaidASCII`: `maxInputLength`, `maxNodes`, `maxEdges` (and `maxCanvasCells` for ASCII) are checked before layout and throw `LimitExceededError` (`code: 'LIMIT_EXCEEDED'`). Defaults are 100,000 characters, 400 nodes, 600 edges and 2,000,000 canvas cells, so a flowchart above 400 nodes or 600 edges now throws unless you raise the limit (`Infinity` disables one). The MCP render tools use tighter limits (50,000 / 150 / 300 / 1,000,000). See the API reference.

### Patch Changes

- [#1989](https://github.com/dfadler/zombie-mermaid/pull/1989) [`d028603`](https://github.com/dfadler/zombie-mermaid/commit/d028603dbe31376e1e1b26c05749f8719445a7a5) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a TD fan-out whose target box has an even width (a half-column centre) no longer draws one arrowhead a column right of its stem; the bundled-edge arrowhead and junction connector now use the same column as the routed stem. Fixes [#1914](https://github.com/dfadler/zombie-mermaid/issues/1914).

- [#1964](https://github.com/dfadler/zombie-mermaid/pull/1964) [`ef0f872`](https://github.com/dfadler/zombie-mermaid/commit/ef0f872d83bf76fa65cbcf1ff630700dc5470d4e) Thanks [@dfadler](https://github.com/dfadler)! - ASCII color auto-detection now honors `NO_COLOR` and `FORCE_COLOR` (`FORCE_COLOR` wins), and `TERM=dumb` now beats `COLORTERM`. Fixes [#1863](https://github.com/dfadler/zombie-mermaid/issues/1863).

- [#1968](https://github.com/dfadler/zombie-mermaid/pull/1968) [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce) Thanks [@dfadler](https://github.com/dfadler)! - Source maps no longer embed `sourcesContent`, cutting the shipped `.map` files by about 70% (svg-renderer 1532K to 404K, ascii-renderer 2384K to 556K on disk). Stack traces keep their line numbers. Refs [#1871](https://github.com/dfadler/zombie-mermaid/issues/1871).
- Updated dependencies [[`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a), [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce), [`5e4a9a7`](https://github.com/dfadler/zombie-mermaid/commit/5e4a9a71b2f07c8eceaed50dc764504525065675), [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5), [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d)]:
  - @zombie-mermaid/core@5.3.0
  - @zombie-mermaid/mermaid-parser@5.3.0

## 5.2.0

### Patch Changes

- [#1913](https://github.com/dfadler/zombie-mermaid/pull/1913) [`87336e0`](https://github.com/dfadler/zombie-mermaid/commit/87336e06a1ceb86b1695b807803962ed2a095ce2) Thanks [@dfadler](https://github.com/dfadler)! - Output change: an ASCII `erDiagram` relationship between side-by-side entities of different heights is now drawn on a row inside both boxes, so it reaches a shorter entity's body instead of landing on its bottom border. Fixes [#1911](https://github.com/dfadler/zombie-mermaid/issues/1911).
- Updated dependencies [[`fda110d`](https://github.com/dfadler/zombie-mermaid/commit/fda110dd94834fc268a8b49e3b2b0df56bd873ba), [`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1), [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9), [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef), [`ebdd12f`](https://github.com/dfadler/zombie-mermaid/commit/ebdd12f58f7379dddfa9c93541543349bba5612a)]:
  - @zombie-mermaid/mermaid-parser@5.2.0
  - @zombie-mermaid/core@5.2.0

## 5.1.0

### Patch Changes

- [#1639](https://github.com/dfadler/zombie-mermaid/pull/1639) [`7104031`](https://github.com/dfadler/zombie-mermaid/commit/71040311cdca8de5f3c3ce41c6d9a54209ed8b8f) Thanks [@dfadler](https://github.com/dfadler)! - Ship `THIRD_PARTY_NOTICES.md` in the published tarballs.

- [#1721](https://github.com/dfadler/zombie-mermaid/pull/1721) [`fd1367f`](https://github.com/dfadler/zombie-mermaid/commit/fd1367fda8a8d7759e3883af1fada45e282a0903) Thanks [@dfadler](https://github.com/dfadler)! - ASCII flowcharts laid out `RL` no longer mirror node shapes: trapezoid slants, the flag notch and hexagon brackets keep the same look as in `LR`, matching mermaid.js.

- [#1620](https://github.com/dfadler/zombie-mermaid/pull/1620) [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931) Thanks [@dfadler](https://github.com/dfadler)! - Fix package README inaccuracies and add missing `package.json` metadata ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).
- Updated dependencies [[`3ec564e`](https://github.com/dfadler/zombie-mermaid/commit/3ec564ea51616fceb6facb37709313e15fb8b7d6), [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931)]:
  - @zombie-mermaid/mermaid-parser@5.1.0
  - @zombie-mermaid/core@5.1.0

## 5.0.1

### Patch Changes

- [#1496](https://github.com/dfadler/zombie-mermaid/pull/1496) [`23007f5`](https://github.com/dfadler/zombie-mermaid/commit/23007f5b3356f3531b2a25aebab3aa9974836015) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: the CI/CD Pipeline sample's `Build Image --> Deploy Staging` edge now takes the A*-routed path (up and over the `Tests Pass?` row) instead of a direct-path fallback. The [#1474](https://github.com/dfadler/zombie-mermaid/issues/1474) sealed-target guard stops sealed-target searches draining the render-wide path budget, so the edge's real search is no longer starved. This is an intentional output change; the [#1474](https://github.com/dfadler/zombie-mermaid/issues/1474) note that output is unchanged was wrong for this diagram ([#1493](https://github.com/dfadler/zombie-mermaid/issues/1493)).

- [#1501](https://github.com/dfadler/zombie-mermaid/pull/1501) [`000bea2`](https://github.com/dfadler/zombie-mermaid/commit/000bea2eefcf178646f6a90d2e364b603d191954) Thanks [@dfadler](https://github.com/dfadler)! - ASCII sequence: a message label that spans several participants no longer overwrites the lifelines it passes over; it is centred in a gap wide enough to hold it instead ([#1119](https://github.com/dfadler/zombie-mermaid/issues/1119)).

- [#1498](https://github.com/dfadler/zombie-mermaid/pull/1498) [`2e01fc8`](https://github.com/dfadler/zombie-mermaid/commit/2e01fc855e13681f808cbbd8331763cfc677508f) Thanks [@dfadler](https://github.com/dfadler)! - Speed up ASCII label placement on graphs with many labelled edges: `besideGeometryFree` now reads a per-layout row index of drawn edge segments instead of rescanning every edge for each candidate. Output is unchanged.
- Updated dependencies []:
  - @zombie-mermaid/core@5.0.1
  - @zombie-mermaid/mermaid-parser@5.0.1

## 5.0.0

### Major Changes

- [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444) [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1) Thanks [@dfadler](https://github.com/dfadler)! - **BREAKING:** `elkjs` is now an optional peer dependency of `@zombie-mermaid/svg-renderer` (and no longer a dependency of `@zombie-mermaid/core`), and the library no longer imports it. Browser and bundler apps that render flowchart, state, class, ER or architecture diagrams must `npm install elkjs` and call the new `registerElk(ELK)` once (`import ELK from 'elkjs/lib/elk.bundled.js'`); otherwise rendering those diagrams throws `ElkNotRegisteredError`. Under Node and Bun, `elkjs` is auto-loaded when installed, and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so the CLI and MCP server need no change. Sequence, pie, xychart, C4 and ASCII output never needed it. In exchange, the SVG renderer's browser bundle drops from about 518 KB to 74 KB gzipped (umbrella 576 KB to 130 KB) when elk is not registered, and the published `.d.ts` files no longer import from `elkjs` (the `Elk*` graph types are now exported by `@zombie-mermaid/core`). See `docs/guides/elkjs-optional-peer.md`.

### Patch Changes

- [#1451](https://github.com/dfadler/zombie-mermaid/pull/1451) [`4503879`](https://github.com/dfadler/zombie-mermaid/commit/4503879bc8a8e6278af76d7e2d01169d1818c665) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a bidirectional edge's start arrowhead no longer overwrites the source node's border. It now sits in the first stroke cell, mirroring the end arrowhead, and the border keeps a tee where the stroke leaves. A labelled horizontal bidirectional edge gets one extra column so the label does not cover the start head (fixes [#1438](https://github.com/dfadler/zombie-mermaid/issues/1438)).

- [#1465](https://github.com/dfadler/zombie-mermaid/pull/1465) [`a729295`](https://github.com/dfadler/zombie-mermaid/commit/a72929571406147b3676107e2c5d5d6abbd703fc) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a cluster with a single member is now centred over its exit targets in TD, as a plain node already is, instead of hanging over the first target ([#1462](https://github.com/dfadler/zombie-mermaid/issues/1462)).

- [#1429](https://github.com/dfadler/zombie-mermaid/pull/1429) [`e38848d`](https://github.com/dfadler/zombie-mermaid/commit/e38848dd48e66b732c6fd7f0c667e91643c2840c) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in a top-down flowchart, when three sibling edges leave a cluster for the same target, the third now enters the target's side face one row below the second instead of merging into its stroke, so each label's edge can be followed to its own arrowhead. The two-sibling layout is unchanged (closes [#1331](https://github.com/dfadler/zombie-mermaid/issues/1331)).

- [#1454](https://github.com/dfadler/zombie-mermaid/pull/1454) [`b7d7c58`](https://github.com/dfadler/zombie-mermaid/commit/b7d7c580281cea1c184bc7e4d0b3aeb77861a098) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: the grid occupancy map now uses numeric cell keys instead of "x,y" strings, making flowchart edge routing about 15% faster on the sample set. Output is unchanged ([#1424](https://github.com/dfadler/zombie-mermaid/issues/1424)).

- [#1473](https://github.com/dfadler/zombie-mermaid/pull/1473) [`e16dc91`](https://github.com/dfadler/zombie-mermaid/commit/e16dc91291843c52b960efd1f425f0fc33bdb915) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: edge-label placement is memoised within each placement call, cutting render time on graphs with many labelled edges on shared vertical legs (about 45x at 29 edges; it was growing roughly cubically). Output is unchanged ([#1466](https://github.com/dfadler/zombie-mermaid/issues/1466)).

- [#1471](https://github.com/dfadler/zombie-mermaid/pull/1471) [`b4a89b4`](https://github.com/dfadler/zombie-mermaid/commit/b4a89b4434815220373dcaea9c5eb963a3d811b8) Thanks [@dfadler](https://github.com/dfadler)! - Draw labeled parallel edges side by side on the same faces too, like the unlabeled ones. In a vertical pair the labels stagger onto separate rows so neighbours never overprint; a group with more label lines than gap rows keeps the side lane. Closes [#1455](https://github.com/dfadler/zombie-mermaid/issues/1455).

- [#1472](https://github.com/dfadler/zombie-mermaid/pull/1472) [`4d8a9e4`](https://github.com/dfadler/zombie-mermaid/commit/4d8a9e424ba691a45aac4e37bcd6f6d2b5b0292d) Thanks [@dfadler](https://github.com/dfadler)! - Speed up ASCII rendering of large flowcharts: per-edge overlay layers now track the cells they touch, so merge and role passes no longer rescan the whole canvas for every edge ([#1458](https://github.com/dfadler/zombie-mermaid/issues/1458)).

- [#1494](https://github.com/dfadler/zombie-mermaid/pull/1494) [`105f069`](https://github.com/dfadler/zombie-mermaid/commit/105f069435db9ebf1b33a15aff770b2f77b134d8) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: LR labeled fan-in edges no longer leave their source from the box corner or cross another label's lane; the pathfinder lane-avoidance that conflicted with the split-lane routing is removed, so each label keeps its own lane ([#1467](https://github.com/dfadler/zombie-mermaid/issues/1467)).

- [#1486](https://github.com/dfadler/zombie-mermaid/pull/1486) [`6202ea2`](https://github.com/dfadler/zombie-mermaid/commit/6202ea2667ebefef4e394e9b6856f8ff081dc41f) Thanks [@dfadler](https://github.com/dfadler)! - In LR flowcharts, labeled edges from different sources into one node no longer share a single under-row lane and drop when two or more of them run along the same bent path. Each gets its own lane so its label sits on its own stroke. Plain tee merges and unlabeled fan-in are unchanged. Closes [#1467](https://github.com/dfadler/zombie-mermaid/issues/1467).

- [#1449](https://github.com/dfadler/zombie-mermaid/pull/1449) [`89c25c4`](https://github.com/dfadler/zombie-mermaid/commit/89c25c44f24c2e6ae61c84e217ee1afa22e58e16) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: a `direction RL` or `direction BT` inside a subgraph is now honored (it was drawn as `LR`/`TD`). The subgraph's box is mirrored in place, relative to the direction around it; a subgraph with an edge crossing its boundary still inherits the parent's direction (closes [#1421](https://github.com/dfadler/zombie-mermaid/issues/1421)).

- [#1428](https://github.com/dfadler/zombie-mermaid/pull/1428) [`204487a`](https://github.com/dfadler/zombie-mermaid/commit/204487a85e1eff57ccedf2900d3b4e6f426e5125) Thanks [@dfadler](https://github.com/dfadler)! - Draw unlabeled parallel edges between two nodes stacked in one column (or side by side in one row) as strokes running side by side on the same faces, like the SVG, instead of sending every edge after the first around the side of the boxes. Labeled groups and faces too narrow for the strokes keep the side lane. Closes [#1394](https://github.com/dfadler/zombie-mermaid/issues/1394).

- [#1484](https://github.com/dfadler/zombie-mermaid/pull/1484) [`78df967`](https://github.com/dfadler/zombie-mermaid/commit/78df96703c21c262f7aa8a4285d79f1ae5ebcca2) Thanks [@dfadler](https://github.com/dfadler)! - Speed up ASCII rendering of dense flowcharts: each edge's drawn path is now computed once per draw instead of once per label-placement candidate ([#1458](https://github.com/dfadler/zombie-mermaid/issues/1458)).

- [#1481](https://github.com/dfadler/zombie-mermaid/pull/1481) [`ad232b8`](https://github.com/dfadler/zombie-mermaid/commit/ad232b81d037f045114990f96a406ef554be94a3) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: edge routing no longer floods the grid with A* iterations when an edge target is sealed off (e.g. by a style-conflict reroute's temporary block); the search now fails immediately. Output is unchanged ([#1474](https://github.com/dfadler/zombie-mermaid/issues/1474)).

- [#1482](https://github.com/dfadler/zombie-mermaid/pull/1482) [`645fd05`](https://github.com/dfadler/zombie-mermaid/commit/645fd05d8e62ea5acdcb7573fea6d8aba50be6ad) Thanks [@dfadler](https://github.com/dfadler)! - Cut memory and time on large ASCII flowcharts: per-edge overlay layers now share a blank column until a cell is written, instead of allocating the full canvas area for every edge ([#1478](https://github.com/dfadler/zombie-mermaid/issues/1478)).

- [#1423](https://github.com/dfadler/zombie-mermaid/pull/1423) [`5c8967b`](https://github.com/dfadler/zombie-mermaid/commit/5c8967b26c0d290473d27701f0059d30332603c6) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: the double-line state-end box (`[*]` as a target) kept wrong corners under `BT` and `RL` (`╗═══╔` instead of `╔═══╗` for `RL`, top and bottom swapped for `BT`). The flips now remap `╔╗╚╝` too (refs [#1372](https://github.com/dfadler/zombie-mermaid/issues/1372)).

- [#1452](https://github.com/dfadler/zombie-mermaid/pull/1452) [`3be6d07`](https://github.com/dfadler/zombie-mermaid/commit/3be6d07368e5087f1b9da80dbfaa9edb5828f3b2) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in a TD flowchart, unbundled edges into one node from different sources now each keep their own path and arrowhead, as Mermaid draws them, instead of merging into one leg and one arrowhead ([#1436](https://github.com/dfadler/zombie-mermaid/issues/1436)).

- [#1452](https://github.com/dfadler/zombie-mermaid/pull/1452) [`213ae4a`](https://github.com/dfadler/zombie-mermaid/commit/213ae4aa12799ab5d88c2c8234d3fad584b20e82) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in a TD flowchart, unbundled edges into one node from different sources no longer run down one shared column, so each can be traced back to its source ([#1439](https://github.com/dfadler/zombie-mermaid/issues/1439)).

- [#1452](https://github.com/dfadler/zombie-mermaid/pull/1452) [`cd6153b`](https://github.com/dfadler/zombie-mermaid/commit/cd6153b0defff666120ec93149a0d3c163d92838) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in a TD flowchart, a label beside a vertical stroke keeps one blank cell from a sibling stem even when a junction row sits right below it, and a label on a lane shared with other edges sits just below where its own edge joins instead of mid-lane ([#1434](https://github.com/dfadler/zombie-mermaid/issues/1434), [#1435](https://github.com/dfadler/zombie-mermaid/issues/1435)).

- [#1420](https://github.com/dfadler/zombie-mermaid/pull/1420) [`36448f7`](https://github.com/dfadler/zombie-mermaid/commit/36448f784cc7de50cfe90d71fcbe5c5eb80f5d1a) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in a TD flowchart, two labelled edges sharing a lane no longer pick the same segment for their labels, so the later label no longer overwrites (and hides) the earlier one ([#1413](https://github.com/dfadler/zombie-mermaid/issues/1413)).

- [#1461](https://github.com/dfadler/zombie-mermaid/pull/1461) [`3b4c0ad`](https://github.com/dfadler/zombie-mermaid/commit/3b4c0adfbaa9f889b3c471d8100af40acc11f11e) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: cluster exits no longer share one gutter bus. Each sibling turns off the stub on its own row (TD) or column (LR), farthest target first, so every label reads against its own drop ([#1331](https://github.com/dfadler/zombie-mermaid/issues/1331)). A two-exit cluster now takes one more row or column than before.

- [#1448](https://github.com/dfadler/zombie-mermaid/pull/1448) [`4583ab7`](https://github.com/dfadler/zombie-mermaid/commit/4583ab743e1634ed06c274d62bf674f53086544f) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in an LR flowchart, a label on a horizontal run no longer covers a sibling edge's stem leaving the same node, which left that edge without a visible path and two edges that share a drop into one node no longer print their labels on the same cell, which erased one of them ([#1433](https://github.com/dfadler/zombie-mermaid/issues/1433)).

- [#1464](https://github.com/dfadler/zombie-mermaid/pull/1464) [`5ca72d5`](https://github.com/dfadler/zombie-mermaid/commit/5ca72d5e2bda0a0430f828b708ff0c32630af31f) Thanks [@dfadler](https://github.com/dfadler)! - ASCII: in an LR flowchart, a label that slides along a shared stem no longer lands on a later edge's lane label and overprints it (`sixtfifth`) ([#1463](https://github.com/dfadler/zombie-mermaid/issues/1463)).

- [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3) Thanks [@dfadler](https://github.com/dfadler)! - Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop the unused `entities` dependency declaration from mcp (refs [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426)).
- Updated dependencies [[`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1), [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3)]:
  - @zombie-mermaid/core@5.0.0
  - @zombie-mermaid/mermaid-parser@5.0.0

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
