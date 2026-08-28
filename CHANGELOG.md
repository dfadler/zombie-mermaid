# Changelog

## 1.3.0

### Minor Changes

- [#207](https://github.com/dfadler/zombie-mermaid/pull/207) [`3c809ca`](https://github.com/dfadler/zombie-mermaid/commit/3c809cabb07bc97bda999ff5687d20c296f167ac) Thanks [@dfadler](https://github.com/dfadler)! - Support Mermaid's expanded node syntax, `A@{ shape: doc, label: "Report" }` (v11.3.0+, from the audit in [#198](https://github.com/dfadler/zombie-mermaid/issues/198)).

  The syntax did not parse at all before: `A@{ shape: doc }` fell through to the bare-id pattern, so a node called `A` was registered and the entire metadata block was stranded as unparsed text — losing both the shape and the label with no error.

  All 124 documented Mermaid shape names and aliases now resolve, and 23 new geometries are drawn that the classic bracket syntax cannot express: document, stacked document/process, card, lined/divided/window-pane rectangles, triangles, filled and crossed circles, fork bar, notched pentagon, sloped rectangle, flag, bow-tie rectangle, delay, braces, lightning bolt, bare text, and anchor.

  Block scanning is depth- and quote-aware, so a label containing `}` (`A@{ label: "a } b" }`) does not terminate the block early, and values may contain commas and colons. `icon:` and `img:` are parsed with `form:` selecting the outline; since this renderer draws neither FontAwesome glyphs nor remote images, an unlabelled icon/image node shows its reference as text rather than rendering blank. An unrecognized shape name falls back to a rectangle rather than failing the diagram.

- [#208](https://github.com/dfadler/zombie-mermaid/pull/208) [`9be2755`](https://github.com/dfadler/zombie-mermaid/commit/9be27553fabdd0859b4b0bc0f34314d2fa2abd21) Thanks [@dfadler](https://github.com/dfadler)! - Support the interactivity and configuration rows of the flowchart syntax audit ([#198](https://github.com/dfadler/zombie-mermaid/issues/198)): `click`, `%%{init:...}%%` directives, edge curve styles, edge IDs with animation, and Mermaid's backtick markdown-string form.

  **`click` interactions.** `click A "url" "tooltip" _target` and `click A call fn()` now parse. An href becomes a real SVG `<a>` link and a tooltip becomes a `<title>`, both working without script. Only `http`/`https`/`mailto` and relative or fragment references are emitted — a `javascript:` or `data:` href is dropped, since diagram text may be untrusted and an executable href would make any page that inlines the SVG vulnerable. An href containing a C0 control character is rejected outright: the URL parser strips tab and newline from anywhere in a URL, so `java<TAB>script:` would otherwise pass the scheme check as a relative reference and still reach the browser as `javascript:`. A callback is recorded as `data-click-callback` and never invoked; this renderer executes nothing a diagram supplies.

  **`%%{init: ...}%%` directives.** Mermaid's relaxed JSON (unquoted keys, single quotes) is parsed, and a malformed directive is ignored rather than fatal. A directive supplies a default and never overrides an explicit render option. Keys that are parsed but deliberately not acted on — `securityLevel`, `defaultRenderer`, `fontFamily`, `htmlLabels`, `maxTextSize` — are reported with a reason rather than vanishing silently.

  **Edge curve styles.** `flowchart.curve` accepts `linear`, `basis`, `natural`, `step`, `stepBefore`, and `stepAfter`. The default `linear` still emits `<polyline class="edge">`, so existing selectors keep working; only a non-linear curve switches to `<path>`. `basis` is a direct port of d3's `curveBasis`, verified to match its output exactly, so a curved edge traces the path Mermaid would draw. `natural` is deliberately _not_ d3's natural spline — see the note in `src/edge-curves.ts`.

  **Edge IDs and animation.** `A e1@--> B` assigns an edge id, emitted as `data-id`, and `e1@{ animate: true }` renders a marching-ants dash via CSS keyframes, guarded by `prefers-reduced-motion`. Keyframes are emitted only when a diagram animates an edge.

  **Markdown strings.** Mermaid's backtick-delimited form (``A["`**bold**`"]``) now has its backticks stripped; they previously rendered as literal characters. The `**bold**` / `*italic*` / `~~strike~~` conversions themselves already worked.

- [#206](https://github.com/dfadler/zombie-mermaid/pull/206) [`673d3da`](https://github.com/dfadler/zombie-mermaid/commit/673d3da22305af381ac167e85d4b17fb20427dc6) Thanks [@dfadler](https://github.com/dfadler)! - Close four flowchart syntax gaps against the Mermaid spec (from the audit in [#198](https://github.com/dfadler/zombie-mermaid/issues/198)). Each previously failed silently — mis-parsing into something else rather than raising an error.

  **Parallelogram shapes.** `A[/text/]` and `A[\text\]` are now parsed and rendered in both backends. Previously neither pattern matched any shape, so the node fell through to other parsing. Note these are distinct from the already-supported trapezoids: a parallelogram's delimiters mirror (`[/…/]`), a trapezoid's oppose (`[/…\]`).

  **Variable-length edges.** `A ---- B`, `A ====> B`, `A -..-> B` and longer runs now parse as a single edge. The arrow regex matched a fixed alternation of the shortest forms, so surplus characters were stranded and corrupted the following token — surfacing as spurious extra nodes rather than an error. Run length is a layout-rank hint in Mermaid; it is now parsed without being mis-tokenized, though the rank hint itself is not yet applied to layout.

  **Invisible links.** `A ~~~ B` is supported as a new `invisible` edge style. The edge participates in layout but draws no line, connector, or arrowhead. In SVG the element is retained with `stroke="none"` so it stays inspectable via `data-style`; in ASCII its cells are left blank.

  **`classDef default` auto-apply.** A `classDef default` now styles every node, as in Mermaid, rather than only nodes that named it explicitly via `class X default`. A node's own class overrides it property by property, and `style` directives override both. Diagrams relying on `classDef default` previously rendered unstyled with no error.

### Patch Changes

- [#217](https://github.com/dfadler/zombie-mermaid/pull/217) [`ecf86af`](https://github.com/dfadler/zombie-mermaid/commit/ecf86afd86c2e5cc3b9c43599ccc6f1f8982b71b) Thanks [@dfadler](https://github.com/dfadler)! - Stop `mergeEdges` bundling from drawing an edge straight through the nodes it skips over.

  Bundling replaces a routed edge with a shared trunk plus a straight branch to each endpoint. That substitution assumed the branch only ever spans the gap between two adjacent layers. When a fan-out reaches a target several layers down, the branch instead crosses every layer in between — and any node standing in its column got a line drawn through the middle of it.

  In this diagram, `A --> C` was bundled with `A --> B`, which pinned its junction to the gap just below `A` and then dropped it in one unbroken run to `C`, straight through `B` and `F`:

  ```mermaid
  flowchart TB
    A[PR push] --> B[CI workflows]
    A --> C[merge status bot]
    B --> F[workflow_run events]
    F --> C
  ```

  A bundled branch is now checked against every node box before it is adopted; a branch that would collide keeps the layout engine's own routing, which already goes around the obstacles. If that leaves fewer than two branches in a bundle there is no trunk left to share, so the whole group stays as routed. The same check guards the fan-in pass, which could otherwise re-introduce the crossing on an edge the fan-out pass had just declined to bundle.

  Bundles whose endpoints share a layer — the common fan-out and fan-in shapes — are unaffected and still merge into a single trunk.

- [#203](https://github.com/dfadler/zombie-mermaid/pull/203) [`571fb9a`](https://github.com/dfadler/zombie-mermaid/commit/571fb9a97878c2c65a8e32c0b1cc12aae7edc501) Thanks [@dfadler](https://github.com/dfadler)! - Fix class and ER diagram ASCII boxes overflowing their own borders when they contain CJK, fullwidth, or other wide characters.

  `drawMultiBox` measured text with `line.length` and wrote it one UTF-16 code unit per grid cell, so a wide glyph — which occupies two terminal columns — was sized as one. The same code-unit arithmetic was duplicated in `class-diagram.ts` and `er-diagram.ts`, which precompute box dimensions to reserve grid space before drawing, and in both renderers' relationship-label placement.

  All of these now measure display width. The box-sizing arithmetic is consolidated into a single `measureMultiBox` helper that `drawMultiBox` and both callers share, so the space reserved by layout and the box actually drawn can no longer disagree — a desync that silently ate the gap between adjacent boxes.

  This completes for multi-compartment boxes what [#66](https://github.com/dfadler/zombie-mermaid/issues/66) fixed for single boxes.

- [#204](https://github.com/dfadler/zombie-mermaid/pull/204) [`f0e533e`](https://github.com/dfadler/zombie-mermaid/commit/f0e533e75c98446e262ddd48d76004157cc6b438) Thanks [@dfadler](https://github.com/dfadler)! - Support semicolons as statement separators in every diagram type.

  `detectDiagramType` isolated the header by splitting on newline _or_ semicolon, so `sequenceDiagram;A->>B: Hi` routed correctly to the sequence pipeline — but each parser then split the body on newlines only. Everything after the header was discarded and the diagram rendered empty. The same gap affected `classDiagram`, `erDiagram`, and `xychart-beta`.

  Flowcharts were broken differently: `flowchart TD;A-->B` did not render empty, it threw `Invalid mermaid header`, even though `graph TD; A-->B;` is long-standing Mermaid syntax.

  Statement splitting now lives in one shared `splitStatements` helper used by the detector and all five parser entry points, so routing and parsing cannot disagree about where a statement ends. A semicolon inside a quoted label (`A["a; b"]`) or terminating a character reference (`A[&amp;]`, `A[&#x1F600;]`) is correctly treated as text rather than a separator, and comments are stripped before splitting so a `;` in a comment cannot resurrect the rest of the line as code.

## 1.2.0

### Minor Changes

- [#85](https://github.com/dfadler/zombie-mermaid/pull/85) [`655a723`](https://github.com/dfadler/zombie-mermaid/commit/655a723b55ca9046b9d0b4b81edeb56b20df7798) Thanks [@dfadler](https://github.com/dfadler)! - Add a `zombie-mermaid` CLI for rendering Mermaid diagrams from the command line.

  - `zombie-mermaid render <file> --ascii` — render to ASCII/Unicode art in the terminal
  - `zombie-mermaid render <file> --svg -o <out.svg>` — render to an SVG file
  - `zombie-mermaid render <file> --ascii --svg -o <out.svg> --theme <name>` — both at once, with a built-in theme
  - `cat file.mmd | zombie-mermaid render --ascii` — read from stdin
  - `zombie-mermaid themes` — list available built-in themes
  - `zombie-mermaid --help` / `--version`

  Supports all 6 diagram types (flowchart, sequence, state, class, ER, XY chart), reading from a file argument or stdin, and writing SVG output to disk. The CLI is exposed via a `bin` entry (`zombie-mermaid`) and built as a standalone ESM script with a `#!/usr/bin/env node` shebang.

  Ports [lukilabs/beautiful-mermaid#51](https://github.com/lukilabs/beautiful-mermaid/pull/51) by [@vinceyyy](https://github.com/vinceyyy), adapted to this fork's current public API (`renderMermaidSVG`, `renderMermaidASCII`), pnpm/tsup build setup, and Vitest test suite. Closes [#74](https://github.com/dfadler/zombie-mermaid/issues/74).

- [#83](https://github.com/dfadler/zombie-mermaid/pull/83) [`2ac2d10`](https://github.com/dfadler/zombie-mermaid/commit/2ac2d1085dcf4a2043f2e6b1fe4acd3cfa29a9e8) Thanks [@dfadler](https://github.com/dfadler)! - Add `fontSizes` and `sequence` fields to `RenderOptions`, exposing previously hardcoded font-size and sequence-diagram layout constants for overriding.

  - `fontSizes.nodeLabel` / `edgeLabel` / `groupHeader` (defaults: 13 / 11 / 12) now apply consistently across flowchart, class, ER, and sequence diagrams.
  - `sequence.actorHeight` / `headerGap` / `messageRowHeight` / `noteOffsetAfterMessage` / `noteStackGap` (defaults: 40 / 20 / 40 / 8 / 4) control sequence-diagram layout spacing. The last two were previously unnamed inline magic numbers.

  All fields are optional and fall back to the existing defaults, so this is fully additive and non-breaking.

### Patch Changes

- [#82](https://github.com/dfadler/zombie-mermaid/pull/82) [`98b77fa`](https://github.com/dfadler/zombie-mermaid/commit/98b77fa3341380b2006dced3960a6ed4464146a0) Thanks [@dfadler](https://github.com/dfadler)! - Ship a CommonJS build alongside the existing ESM build so `require('zombie-mermaid')` — and any bundler that resolves dependencies in CJS mode — works instead of throwing `ERR_PACKAGE_PATH_NOT_EXPORTED`. `tsup` now builds both `dist/index.js` (ESM) and `dist/index.cjs` (CJS), each with its own type declarations (`dist/index.d.ts` / `dist/index.d.cts`). The `exports["."]` map now has separate `import` and `require` conditions, each with its own nested `types`/`default`, and the legacy `main` field now points at the CJS build (previously ESM) so non-`exports`-aware resolvers get a working fallback instead of a broken one.

- [#50](https://github.com/dfadler/zombie-mermaid/pull/50) [`e1a222c`](https://github.com/dfadler/zombie-mermaid/commit/e1a222ca2804fb970357dc98ea791b3a06f08393) Thanks [@dfadler](https://github.com/dfadler)! - Fix double-reversed start-arrow markers in SVG output. `orient="auto-start-reverse"` already rotates the arrowhead 180° so it points back out of the source node — but the `arrowhead-start` marker's polygon points were also pre-reversed, canceling out the rotation. The arrowhead ended up pointing into the line instead of away from it, which some renderers (librsvg, Inkscape) render as an invisible/degenerate marker. Both the default and per-color (`linkStyle`) marker variants had the bug; both are fixed by sharing one polygon between the forward and reverse marker.

- [#97](https://github.com/dfadler/zombie-mermaid/pull/97) [`a5fe059`](https://github.com/dfadler/zombie-mermaid/commit/a5fe05995489d7988f929324a52963997878a9e9) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII-charset rendering (`{ useAscii: true }`) never drawing a junction character where an edge exits a node's border — the border stayed a plain run of dashes (e.g. `+--------------+`) at the exact column a connector dropped or branched from it, while Unicode mode correctly drew a T-junction there (e.g. `└───────┬──────┘`). Both `drawBoxStart` and the fan-in bundle's box-start connector now write the ASCII junction character (`+`) instead of skipping junction placement entirely in ASCII mode.

- [#94](https://github.com/dfadler/zombie-mermaid/pull/94) [`1c5f215`](https://github.com/dfadler/zombie-mermaid/commit/1c5f215098fa0a37e9591a73ca7cc5ec21c567b2) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII/Unicode-charset box borders misaligning when a node label, edge label, or subgraph title contains CJK/kana/hangul/fullwidth-form or emoji characters. The ASCII grid is column-major with one grid cell per JS code point, but wide characters like these render as **two** columns in a real monospace terminal — so box width (previously computed via `.length`, i.e. UTF-16 code units) was undercounted, and right borders ended up narrower than the label they were supposed to enclose.

  Both the sizing and drawing sides are now display-width-aware, reusing the same wide-character detection (`isWideChar`, extracted from the existing SVG text-metrics `isFullwidth`/emoji logic) via a new shared `src/ascii/display-width.ts` module:

  - `displayWidth()` replaces `.length` everywhere a label's rendered width is measured for box/column sizing (`multiline-utils.ts`, `shapes/rectangle.ts`, `shapes/stadium.ts`, `shapes/special.ts`, edge-label column reservation in `edge-routing.ts`, edge-label centering in `draw-arrows.ts`, and subgraph-title centering in `draw-subgraphs.ts`).
  - `toDisplayCells()`/`drawText()` write each wide character into the grid as two cells (the glyph plus a placeholder), so cell count matches display-column count and the character-writing math agrees with the box-width math.

  Example — `A[日本語テスト] --> B[終了]` in both charsets now renders with every row occupying the same 16 terminal columns instead of the label row silently overflowing its own border.

- [#92](https://github.com/dfadler/zombie-mermaid/pull/92) [`407355c`](https://github.com/dfadler/zombie-mermaid/commit/407355cde3ccba082cfb6dba9450384bb453b395) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII class diagrams rendering a spurious blank compartment for classes with methods but no attributes.

- [#91](https://github.com/dfadler/zombie-mermaid/pull/91) [`77b5e3d`](https://github.com/dfadler/zombie-mermaid/commit/77b5e3da2215a0cab4aaa80c903866860d039e88) Thanks [@dfadler](https://github.com/dfadler)! - Fix three ASCII-renderer flowchart bugs (issue [#65](https://github.com/dfadler/zombie-mermaid/issues/65)):

  - `--o` and `--x` edges (e.g. `A --o B`) silently dropped the target node and the edge itself, with no error — the flowchart parser's arrow regex didn't recognize these tokens at all, so parsing broke out of the edge-line loop early. `--o`/`--x`/`o--`/`x--`/`o--o`/`x--x` are now recognized (`src/parser.ts`).
  - An edge whose endpoint is a subgraph id (e.g. `ONE --> TWO` where `ONE`/`TWO` are subgraph ids, not nodes) produced two stray disconnected phantom boxes in the ASCII output instead of connecting the two subgraph frames. The ASCII converter now resolves a subgraph-id endpoint to a real member node at that subgraph's boundary, mirroring how the SVG/ELK path already treats the subgraph id as a valid compound-node edge endpoint (`src/ascii/converter.ts`).
  - Inline `<i>`/`<b>`/`<em>`/`<strong>` tags in node/edge labels rendered literally in ASCII output instead of being stripped (`<br/>` was already handled). They're now stripped via the existing `stripFormattingTags` helper (`src/ascii/converter.ts`).

- [#89](https://github.com/dfadler/zombie-mermaid/pull/89) [`5fa08d0`](https://github.com/dfadler/zombie-mermaid/commit/5fa08d02245ff53ac113e29af71ca009c16635a9) Thanks [@dfadler](https://github.com/dfadler)! - Fix several bugs in the ASCII/Unicode renderer's edge-routing and root-detection engine ([#64](https://github.com/dfadler/zombie-mermaid/issues/64)):

  - **Crash**: dense fan-in/fan-out graphs could exhaust the heap during edge routing. A* pathfinding is now bounded by a render-wide iteration budget (not just a per-call cap), and unobstructed edges take a direct route without invoking A* at all.
  - **Crash**: root detection used a single order-dependent forward pass over the parsed nodes, which could misclassify a node as a root when a `child --> parent` edge appeared in the source after a `parent --> grandchild` edge — leading to `Map maximum size exceeded` on some graphs. Root detection is now a two-pass, order-independent algorithm (collect every edge target, then anything never targeted is a root), with a fallback seed node for graphs that are entirely a cycle (no node is ever a true root).
  - Fan-in root nodes are now grouped by their shared downstream target before grid placement, so e.g. `A1, A2 --> A` and `B1, B2 --> B` are placed contiguously instead of interleaved.
  - Sibling edges from the same source now share a straight trunk instead of one taking an unnecessary zigzag detour, by preferring an unobstructed direct route over an equal-length A\* zigzag.
  - The box-start connector (`├`/`┤`/`┬`/`┴`) no longer drifts off the source node's border when a sibling edge's label widens a shared grid column.

- [#96](https://github.com/dfadler/zombie-mermaid/pull/96) [`a52458c`](https://github.com/dfadler/zombie-mermaid/commit/a52458c49afbdb5eb363fff177f7bf7740352cd8) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII flowchart rendering where an edge-less node inside a subgraph could merge that subgraph's frame with a neighboring sibling subgraph. `createMapping`'s root-node placement (`src/ascii/grid.ts`) was subgraph-agnostic: an edge-less node (treated as an initial "root" since it has no incoming edges) could land in the same row/column band as an unrelated sibling subgraph's real root, purely because both were "roots." That made one subgraph's bounding box balloon out to enclose the sibling's, corrupting both frames' borders and titles when drawn (e.g. two titles interleaving into garbled text). Root nodes whose subgraph has other, unreachable-from-them members are now deferred and anchored next to their already-placed subgraph siblings instead, keeping sibling subgraphs' bounding boxes disjoint in both `TD` and `LR` directions.

- [#98](https://github.com/dfadler/zombie-mermaid/pull/98) [`374ebec`](https://github.com/dfadler/zombie-mermaid/commit/374ebecea8112719f756468a588c547cf4be9017) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII/Unicode subgraph title rows sometimes rendering with no left padding at all (e.g. `│Second │` instead of a title that, like every other row in the box, never touches the border). The old centering formula in `drawSubgraphLabel` always gave any unavoidable leftover column to the _right_ side of the title, which could zero out the left padding whenever the label length and the box's interior width had opposite parity. It now biases the leftover column to the right side's padding instead, guaranteeing at least one space of left padding whenever the box has any slack.

- [#71](https://github.com/dfadler/zombie-mermaid/pull/71) [`29d6711`](https://github.com/dfadler/zombie-mermaid/commit/29d6711ee454d58c16f2e305373a18a84334cbac) Thanks [@dfadler](https://github.com/dfadler)! - Fix flowchart subgraph parsing for non-ASCII (e.g. CJK) subgraph ids and quoted bracket titles. `subgraph <id> [<Title>]` matched the id with an ASCII-only `[\w-]+` pattern, so a non-ASCII id like `柜体` failed to match and the whole line fell through to `subgraph <Title>` slugification instead — and a CJK-only `subgraph <Title>` (no bracket form) slugified to an _empty_ id, since the id derivation stripped all non-`\w` characters. Both now preserve Unicode letters/numbers in the id, and `subgraph id ["Quoted Title"]` / `subgraph "Quoted Title"` correctly strip the surrounding quotes from the label.

- [#53](https://github.com/dfadler/zombie-mermaid/pull/53) [`50d8568`](https://github.com/dfadler/zombie-mermaid/commit/50d8568b89b9b1f41ffe38f5b404bb485bc75c39) Thanks [@dfadler](https://github.com/dfadler)! - Fix flowchart `class` assignment statements with a trailing semicolon (e.g. `class B highlight;`), which Mermaid treats as valid/optional syntax. The class-assignment regex was anchored on `(\w+)$` and didn't match the semicolon, so the statement fell through to node parsing and rendered a stray node labelled "class" instead of applying the class. `classDef`/`style` statements already tolerated a trailing semicolon; `class` now matches them.

- [#77](https://github.com/dfadler/zombie-mermaid/pull/77) [`ffa9a85`](https://github.com/dfadler/zombie-mermaid/commit/ffa9a8560cf101ad92798cbfc66e5bffd0adba37) Thanks [@dfadler](https://github.com/dfadler)! - Fix flowchart node labels being dropped when the `:::className` class shorthand appears before the shape brackets (e.g. `A:::external[External User]`). The node-shape regexes require the id to sit immediately before its bracket delimiters (`^([\w-]+)\[...\]`), so a `:::className` token in between caused every shape pattern to miss, falling back to a bare-id match that discarded the bracketed label entirely. The class shorthand is now stripped out before shape matching runs, regardless of whether it appears before or after the brackets.

- [#75](https://github.com/dfadler/zombie-mermaid/pull/75) [`7b4828b`](https://github.com/dfadler/zombie-mermaid/commit/7b4828b506244eac3e52a280e9842bfbbdae46c9) Thanks [@dfadler](https://github.com/dfadler)! - Fix flowchart nodes with a custom class (via `:::className` shorthand or `class A,B className`) not emitting the class name onto the rendered SVG element. The class name was already resolved against `classDef` for inline `fill`/`stroke` styling, but never written to the element's `class` attribute, so external CSS couldn't target it — unlike mermaid.js. The rendered `<g>` now carries `class="node <className>"` (e.g. `class="node highlight"`) alongside the existing base `node` class, with the class name validated as a CSS identifier before being emitted.

- [#95](https://github.com/dfadler/zombie-mermaid/pull/95) [`376be39`](https://github.com/dfadler/zombie-mermaid/commit/376be39686e52a92d62ba835c526212b33eb9df7) Thanks [@dfadler](https://github.com/dfadler)! - Fix a stray `├` (tee) character on flowchart decision-node edge labels in the ASCII/Unicode renderer, `LR` direction with the default Unicode box-drawing charset ([#86](https://github.com/dfadler/zombie-mermaid/issues/86)). The box-start connector for an edge exiting a node's right/left/top/bottom border always emitted a junction character, even when the grid cell it landed on had no real perpendicular border line to merge with — producing a disconnected `├`/`┤`/`┬`/`┴` glyph with blank cells on both sides instead of a plain line. It now only emits a tee/junction character when a genuine border line is actually present at that cell, falling back to a plain `─`/`│` line character otherwise.

- [#81](https://github.com/dfadler/zombie-mermaid/pull/81) [`6e8a8b9`](https://github.com/dfadler/zombie-mermaid/commit/6e8a8b9ddb86767b23f886d98f2b74dc4e24d0c8) Thanks [@dfadler](https://github.com/dfadler)! - Fix two ER diagram parser gaps (issue [#59](https://github.com/dfadler/zombie-mermaid/issues/59), items 2 and 3):

  - Entity aliases (`p[Person] { ... }` and `a["Customer Account"] { ... }`) are now parsed and rendered using the alias as the display label, while relationships and internal lookups still key off the raw entity id. Single-line entity blocks (header, attributes, and closing brace all on one line) are also now supported.
  - The `direction` directive (`direction TB` / `direction LR` / `direction BT` / `direction RL`) is now parsed and threaded through to the ELK layout, changing the axis entities are laid out on. Diagrams with no `direction` statement keep the previous default (left-to-right).

- [#51](https://github.com/dfadler/zombie-mermaid/pull/51) [`15bc7ff`](https://github.com/dfadler/zombie-mermaid/commit/15bc7ffb030b2bc19ce531396ac6deb3cb7af1dc) Thanks [@dfadler](https://github.com/dfadler)! - Fix ER diagram "zero or more" cardinality parsing for the left-side crow's-foot marker (`}o`, e.g. `TAG }o--|| PRODUCT`). The parser normalized cardinality strings by sorting their characters, which conflated the valid `}o` notation with the unrelated pair `{o`/`o{` and left `}o` unrecognized, silently dropping the relationship's cardinality. Left- and right-side notations are now matched explicitly instead of order-normalized. Also fixes the matching bug in the ASCII/Unicode renderer, where the "zero or one" crow's-foot marker (`o|`/`|o`) was drawn with the same character order on both sides of a relationship instead of mirroring to point away from its adjacent entity.

- [#88](https://github.com/dfadler/zombie-mermaid/pull/88) [`f0683b0`](https://github.com/dfadler/zombie-mermaid/commit/f0683b0b6c04bc4b93e687dd923865a61fc06b92) Thanks [@dfadler](https://github.com/dfadler)! - Fix ASCII/Unicode ER diagram relationship labels being truncated and rendered flush against entity boxes. Labels longer than the fixed inter-entity gap (e.g. `"ordered in"`) were silently cut off (`ordere`); the gap between entities is now widened to fit the full label, matching the "widen to fit" convention already used for flowchart edge labels. Relationship labels and cardinality glyph clusters (`││───○╟`) also now keep at least 1 char of padding from both entity box borders instead of sitting flush against them. Diagrams with short labels that already fit the default gap are unaffected and stay compact.

- [#80](https://github.com/dfadler/zombie-mermaid/pull/80) [`37264a5`](https://github.com/dfadler/zombie-mermaid/commit/37264a507d1826e772f5102fb52c845d190e9983) Thanks [@dfadler](https://github.com/dfadler)! - Fix two flowchart parser tokenization bugs ([#61](https://github.com/dfadler/zombie-mermaid/issues/61)). First, `A-->B` (no space before the arrow) dropped the edge entirely: the bare-node-id scanner greedily consumed the leading dashes of the arrow, producing a bogus node `A--` and zero edges. The id pattern now only allows a hyphen between word characters (`step-1`), never a bare/trailing/doubled one, so it stops cleanly before `-->`, `---`, `-.->`, `==>`, `-.-`, and `===` even with no surrounding whitespace, while still supporting legitimately hyphenated ids like `my-node`. Second, brackets inside a double-quoted label corrupted the label: `A["test [] brackets"]` produced `"test [` because the shape-delimiter scanner treated the first `]` _inside_ the quoted string as the node's closing bracket. The scanner is now quote-aware for all shape delimiters (`]`, `)`, `}`, and their double/triple variants), so a complete `"..."` span is skipped over intact and brackets inside quoted labels are preserved as literal text.

- [#79](https://github.com/dfadler/zombie-mermaid/pull/79) [`6b5da99`](https://github.com/dfadler/zombie-mermaid/commit/6b5da9993410e8eb4597ddc314632e03c0b524d9) Thanks [@dfadler](https://github.com/dfadler)! - Fix `RenderOptions.font` breaking when passed a CSS `var(...)` reference (e.g. `{ font: 'var(--font-family-body)' }`), which previously produced a broken Google Fonts `@import` and a quoted, inert `font-family` value. A validated `var()` reference (including one with a quoted fallback argument, e.g. `var(--font, 'Fallback Font')`) now skips the Google Fonts import and is emitted unquoted. Also sanitizes `font` before it's embedded in the generated `<style>` block, since it's user-supplied input.

- [#49](https://github.com/dfadler/zombie-mermaid/pull/49) [`fe048f6`](https://github.com/dfadler/zombie-mermaid/commit/fe048f62746eaddf52b676c931b1f610986d0e47) Thanks [@dfadler](https://github.com/dfadler)! - Fix `mergeEdges` render option being silently ignored — `layoutGraphSync` always used the default value instead of the caller-supplied one, so passing `{ mergeEdges: false }` had no effect. Also documents `mergeEdges` on `RenderOptions` (it was implemented but never exposed in the public type).

- [#93](https://github.com/dfadler/zombie-mermaid/pull/93) [`e989be1`](https://github.com/dfadler/zombie-mermaid/commit/e989be1ab6a17a1fc8a9fcd1ceb5c60f2a8450ab) Thanks [@dfadler](https://github.com/dfadler)! - Fix nested-subgraph `direction` overrides being silently ignored, and edges crossing subgraph boundaries failing to route cleanly (falling back to a naive Z-path or failing to route at all). Cross-boundary edges are now decomposed into a chain of sub-edges joined at explicit ELK ports, one hop per boundary crossed, so ELK can route each hop correctly within its own container level. `mergeEdges` trunk-bundling still works for edges that go through this decomposition.

- [#78](https://github.com/dfadler/zombie-mermaid/pull/78) [`a8fac8f`](https://github.com/dfadler/zombie-mermaid/commit/a8fac8f3644f295e445f02ddb7f185e2ab32655b) Thanks [@dfadler](https://github.com/dfadler)! - Fix per-node `font-family` from `style`/`classDef` (e.g. `style A font-family:monospace`) being parsed but silently dropped during SVG rendering. `renderNodeLabel()` only ever read `node.inlineStyle?.color` for the node's `<text>` element; `font-family` is now emitted as an inline `style="font-family: ...;"` attribute on that node's text — an inline `style` attribute is required (rather than a `font-family` presentation attribute, which is how `color`/`fill` are handled) because the global `font` render option is applied via a `text { font-family: ... }` rule in the embedded stylesheet, and presentation attributes always lose to stylesheet rules regardless of selector specificity. This makes the per-node override reliably win for that one node while every other node keeps falling back to the global font stack.

- [#76](https://github.com/dfadler/zombie-mermaid/pull/76) [`566b195`](https://github.com/dfadler/zombie-mermaid/commit/566b1955cb06a9e576285ced31ce92382bb719aa) Thanks [@dfadler](https://github.com/dfadler)! - Fix unreadable flowchart node label text when a node has a custom `fill` (from `classDef`/`style`) but no explicit `color`. Text color previously always fell back to the theme foreground (`var(--_text)`), so a light pastel fill in dark mode (or a dark fill in light mode) could render white-on-light or black-on-dark text. When the fill is a concrete, resolvable hex color, the label now picks readable black or white text based on the fill's perceptual luminance; fills that aren't resolvable to a concrete color (CSS variable references, named CSS colors, malformed values) keep using the theme foreground unchanged.

- [#52](https://github.com/dfadler/zombie-mermaid/pull/52) [`bc45526`](https://github.com/dfadler/zombie-mermaid/commit/bc455262db45e5a82f97f3a1a6cd9f2edf7ee5aa) Thanks [@dfadler](https://github.com/dfadler)! - Fix a potential out-of-memory crash in the ASCII/Unicode renderer's A\* pathfinder. On dense graphs where an edge's destination is unreachable through free grid cells, the pathfinder's open-set could grow without bound (`RangeError: Map maximum size exceeded`) instead of terminating. The search now gives up and returns `null` (routing falls back gracefully) after 50,000 iterations.

- [#72](https://github.com/dfadler/zombie-mermaid/pull/72) [`554d7b4`](https://github.com/dfadler/zombie-mermaid/commit/554d7b4679b227192e00b49abf1aaec4c614b7ca) Thanks [@dfadler](https://github.com/dfadler)! - Fix sequence diagram notes placed before the first message (e.g. `Note over A: ...` written before any `A->>B: ...` line) being silently dropped from both the SVG and ASCII/Unicode renderers. Notes are parsed with `afterIndex: -1` for this case, but the layout code only ever looked up notes keyed by an actual message index, so `afterIndex === -1` notes were never positioned or rendered — including in notes-only diagrams with zero messages.

- [#84](https://github.com/dfadler/zombie-mermaid/pull/84) [`d35d921`](https://github.com/dfadler/zombie-mermaid/commit/d35d9211493a0f9bf49cc77648853428f6eebeb0) Thanks [@dfadler](https://github.com/dfadler)! - Fix two bugs in the ASCII sequence-diagram renderer's handling of self-arrows (`A->>A: ...`):

  - A `<br/>` in a self-arrow label was written character-by-character onto a single canvas row with no newline handling, so the embedded `\n` corrupted every column to the right for the rest of the diagram. Self-arrow labels now split on `<br/>`/newlines the same way ordinary message labels, notes, and actor labels already do, giving each line its own correctly-indented row.
  - A self-arrow inside an `alt`/`loop`/`opt` block could be drawn outside the block's wall, because the wall's width was computed from lifeline positions only and ignored the self-arrow's loop glyphs (`├──┐` … `◀──┘`) and label extent. The block wall now also accounts for any self-arrow within its message range, so the header, loop corners, and label no longer get clipped or overwritten.

- [#47](https://github.com/dfadler/zombie-mermaid/pull/47) [`864fca0`](https://github.com/dfadler/zombie-mermaid/commit/864fca01f3b4d6f2e424c7a9b2350ab651908efe) Thanks [@dfadler](https://github.com/dfadler)! - Replace unsafe type assertions with runtime-verified type guards and narrower ambient types for elkjs's undocumented worker internals. No behavior change — internal type-safety hardening only.

- [#70](https://github.com/dfadler/zombie-mermaid/pull/70) [`ecca243`](https://github.com/dfadler/zombie-mermaid/commit/ecca24317dc258b90089cb60c948638e1788f6ba) Thanks [@dfadler](https://github.com/dfadler)! - Improve bundler compatibility: mark the package `"sideEffects": false` so bundlers can safely tree-shake unused exports (the library is a pure computation package with no top-level side effects in its published entry point), and add a `"default"` condition to the `exports` map as a fallback for resolvers that don't fully support conditional exports.

- [#154](https://github.com/dfadler/zombie-mermaid/pull/154) [`01757d9`](https://github.com/dfadler/zombie-mermaid/commit/01757d947b3f29282c0ff0689db786faf48d902f) Thanks [@dfadler](https://github.com/dfadler)! - Fix two ASCII-renderer crashes/corruptions found during a type-safety audit ([#153](https://github.com/dfadler/zombie-mermaid/issues/153)):

  - `createMapping`'s grid-layout level tracker was a fixed-size-100 array, silently producing `NaN` coordinates for flowchart chains deeper than ~25 nodes instead of laying out correctly.
  - `determineLabelLine` could throw `Cannot read properties of undefined (reading 'x')` when a routed edge's path collapsed to a single point (e.g. closely-spaced/adjacent nodes whose preferred routing endpoints coincide).

- [#161](https://github.com/dfadler/zombie-mermaid/pull/161) [`0d85508`](https://github.com/dfadler/zombie-mermaid/commit/0d855080b0360829a11730ecbc421bda1c102403) Thanks [@dfadler](https://github.com/dfadler)! - Fix an ASCII-renderer crash (part of the [#100](https://github.com/dfadler/zombie-mermaid/issues/100) type-safety audit) where `drawArrow` could throw `Cannot read properties of undefined (reading '0')` for a routed edge whose path collapses to a single grid point — e.g. closely-spaced/adjacent nodes whose preferred from/to connectors coincide (the same root cause as [#153](https://github.com/dfadler/zombie-mermaid/issues/153), in a different code path). The box-start connector and end arrowhead are now skipped for that degenerate case instead of indexing into an empty array.

- [#147](https://github.com/dfadler/zombie-mermaid/pull/147) [`1445a40`](https://github.com/dfadler/zombie-mermaid/commit/1445a40377cebdffaf9404f56f37deba8e8e8af4) Thanks [@dfadler](https://github.com/dfadler)! - Fix a potential crash rendering class diagram relationship cardinality labels when ELK.js produces no routed section for an edge (`rel.points` empty). Previously this would throw `Cannot read properties of undefined (reading 'x')`; now the cardinality label is simply skipped for that edge.

- [#178](https://github.com/dfadler/zombie-mermaid/pull/178) [`ae7f2ba`](https://github.com/dfadler/zombie-mermaid/commit/ae7f2ba39e6e884a3fbd11ecf0211befce4dc01f) Thanks [@dfadler](https://github.com/dfadler)! - Unify ASCII edge routing between regular and bundled (fan-in/fan-out) edges, and fix a direction-argument bug in the fast path this introduced. Regular and bundled edges now route through a single shared `routeEdge` (in `pathfinder.ts`): an unobstructed direct L-shaped path is tried before falling back to A* search, trying both corner orientations so the result is correct regardless of which direction a caller passes in.

  That last part matters because it fixes a real bug, not just a cosmetic one: the fast path's `dir` argument is supposed to be the _departure_ direction from the segment's start point, but 3 of the 4 bundled-routing call sites were passing the _arrival_ anchor at the segment's end point instead. This left the fast path dead for those segments (measured: 0 of ~215 fan-out junction→target segments took it in a 1,500-diagram fuzz run), silently falling back to A* every time, which can return a valid but visually zigzagged route instead of the direct one. `routeEdge` now tries both possible corner orientations and takes whichever is unobstructed, so this is fixed at the root instead of requiring every call site to compute the exact geometric departure direction.

  Net effect for bundled (fan-in/fan-out) edges: junction-to-target and source-to-junction segments that have a clear direct route now reliably take it, instead of occasionally getting an equivalent-length but zigzagged A*-search path. Regular (non-bundled) edge routing is unchanged.

  Also: `routeEdge`'s `dir` parameter is now the narrower `CardinalDirection` type (compiler-enforced Up/Down/Left/Right, matching what the routing logic actually handles) instead of the full 9-value `Direction`; `routeEdge` now requires a `pathBudget` instead of silently falling back to an unbudgeted search when one is absent; `routeEdge`/`tryDirectPath`/`isAxisRunFree` moved from `edge-routing.ts` to `pathfinder.ts` (they only ever depended on grid/budget primitives, not on `edge-routing.ts`, and importing them from there deepened an existing module cycle); and `routeEdge` plus bundled-edge routing (`routeBundledEdges`, for both fan-in/fan-out and TD/LR) now have direct test coverage, where previously neither had any.

- [#28](https://github.com/dfadler/zombie-mermaid/pull/28) [`32ddf66`](https://github.com/dfadler/zombie-mermaid/commit/32ddf667f4d4e35e1e5e9340c52806c43a829d50) Thanks [@dfadler](https://github.com/dfadler)! - Fix `renderMermaidASCII` misclassifying a single-line diagram whose header is followed by a semicolon (e.g. `sequenceDiagram;A->>B: Hi`) as a flowchart. Diagram-type detection now isolates the header the same way in both the SVG and ASCII renderers (splitting on newline or semicolon), instead of each renderer implementing its own slightly different detector.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

No GitHub Releases have been published for this repository yet; the entries below are
backfilled from `git tag` history (`vX.Y.Z` tags going back to `v0.1.3`). Commits before
`v0.1.3` (the project's initial release) predate this file and aren't itemized here — see
`git log v0.1.3` for that early history.

## [Unreleased]

> **Note:** starting with the Changesets-based release flow (see
> [RELEASING.md](./RELEASING.md)), new entries are generated automatically
> by `changeset version` as dated version sections, not hand-written under
> `[Unreleased]`. The items below predate that change and accumulated
> before any changesets existed for them; they'll be folded into whatever
> version ships next rather than regenerated from a changeset.

Work merged to `main` since the `v1.1.3` tag, not yet released to npm.

### Added

- Live Mermaid editor page (`editor.ts` / `editor/`), deployed alongside the sample gallery
- Editor button on the site hero, matching the Craft Agents design system
- ESLint (TypeScript-aware flat config) for the codebase
- Semgrep SAST scanning in CI (`semgrep scan --config auto --error`, free public rulesets,
  no account/token), and documented Aikido Safe Chain as the recommended local install-time
  malware/supply-chain protection (closes #12)

### Changed

- Migrated tooling off Bun onto pnpm, Vitest, and esbuild/Node (`chore: move off Bun`)
- Renamed the fork from `beautiful-mermaid` to `zombie-mermaid` (package name, imports,
  README); still MIT-licensed with full attribution to Craft Docs and the original
  `mermaid-ascii` port

### Fixed

- Editor link resolving to the wrong path on pages without a trailing slash, and a
  follow-up fix for a regex/template-literal bug in that same patch (ported from
  upstream `lukilabs/beautiful-mermaid` PRs [#105](https://github.com/lukilabs/beautiful-mermaid/pull/105)
  and [#106](https://github.com/lukilabs/beautiful-mermaid/pull/106))
- Pinned all GitHub Actions in `ci.yml`/`publish.yml` to full commit SHAs instead of mutable
  version tags (Semgrep finding: `github-actions-mutable-action-tag`)
- Added a subresource-integrity hash to the CDN-loaded Chart.js `<script>` tag in
  `xychart-test.html`/`xychart-test.ts` (Semgrep finding: `missing-integrity`)

## [1.1.3] - 2026-02-26

### Fixed

- xychart producing `NaN` colors when theme inputs used CSS variables

## [1.1.2] - 2026-02-26

### Added

- Pre-built JS shipped in the published package for webpack/vite/Node consumers that
  don't run their own TypeScript build step

## [1.1.1] - 2026-02-26

### Changed

- Removed the `prepublishOnly` build hook; added `tsup`/`typescript` as explicit
  devDependencies

## [1.1.0] - 2026-02-26

### Added

- `xychart-beta` diagram type (bar, line, and combined charts) as a proof of concept
- `linkStyles` support for flowchart edges

### Fixed

- CJK state names and text embedded in edge labels rendering incorrectly

## [1.0.2] - 2026-02-23

### Changed

- Removed the DOM lib dependency in favor of ambient declarations for browser globals

### Fixed

- CI type-checking failures (added `@types/bun`, restored DOM lib for test imports)

## [1.0.1] - 2026-02-23

### Changed

- Layout quality improvements and layer alignment in the ELK.js-based layout engine

## [1.0.0] - 2026-02-23

### Added

- ELK.js-powered layout engine (replacing the earlier layout approach)
- Themeable ASCII rendering
- Multiline label support

This was a major rework of the rendering pipeline; see the `v1.0.0` tag for the full
diff against `v0.1.3`.

## [0.1.3] - 2026-01-29

### Added

- Browser bundle for `<script>` tag / CDN usage

### Security

- Escaped inline style attribute values to prevent SVG attribute injection from
  untrusted diagram input

### Fixed

- Semicolons as line separators in the diagram parser (flowchart and SVG renderer)
- README dead links and incorrect attribution (the ASCII renderer was ported from Go,
  not Python)

[Unreleased]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.3...HEAD
[1.1.3]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/dfadler/zombie-mermaid/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/dfadler/zombie-mermaid/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/dfadler/zombie-mermaid/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/dfadler/zombie-mermaid/compare/v0.1.3...v1.0.0
[0.1.3]: https://github.com/dfadler/zombie-mermaid/releases/tag/v0.1.3
