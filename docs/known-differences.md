# Known differences from mermaid.js

Places where zombie-mermaid renders or parses differently from mermaid.js and the
difference is either intentional or not yet fixed. The reference is the pinned
`mermaid` devDependency (12.1.0), rendered headless through
`scripts/lib/real-mermaid.ts`; mermaid.live and GitHub render the same layout.
The pin moved from 11.17.2 in the bump that added this note, and entries not
listed below as re-checked were measured on 11.17.2: other versions may differ.
The "Labeled Fan-In (LR)" mirrored-order entry that used to sit under layout
tie-breaks was removed after a re-check: on 12.1.0 mermaid and zombie-mermaid agree
(100% / 100%, it was 17% on 11.17.2).

## Subgraph inner direction

Re-checked on 12.1.0 (and 11.17.2). Given `subgraph S` holding `a --> b --> c` in a
`graph TD`:

- **No `direction`.** mermaid 11.17.2 flipped an uncrossed subgraph perpendicular to
  its parent (row inside a `TD` graph). mermaid 12.1.0, mermaid.live and GitHub do
  not: the subgraph follows its parent (column). zombie-mermaid never flips, so it
  matches 12.x. A 11.x-based comparison shows a difference that is not one.
- **Explicit `direction`.** Both versions keep it unless an edge crosses the subgraph
  boundary, or an ancestor's. An edge to or from the subgraph's own id (`X --> S`,
  `S --> Y`) does not cross it, so `direction LR` plus `X --> S` is a row. An edge to
  or from a member (`X --> a`, `c --> Y`) crosses, and the subgraph follows its
  parent. zombie-mermaid counts the subgraph's own id as inside, so it draws a column
  for the id-edge cases (#1830 fixes this).

## Layout tie-breaks and placement

Since mermaid 12.0.0, mermaid.js lays out flowcharts, state, class and ER diagrams
with ELK by default (it was dagre in 11.x; see the
[12.0.0 release notes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.0.0)),
and mermaid.live renders that layout. Both engines are now ELK, but with different
options: mermaid sets no `considerModelOrder` and breaks cycles depth-first, while
zombie-mermaid uses `considerModelOrder.strategy: NODES_AND_EDGES` (set in
`packages/svg-renderer/src/layout-engine/to-elk.ts`), so node order within a layer, and
cross-axis offsets between layers, can still differ even when both assign the same
layers. The 12.1.0 comparison is in
[#1834](https://github.com/dfadler/zombie-mermaid/issues/1834).

- **Sibling subgraph order and feedback edges.** zombie-mermaid still imitates
  mermaid 11's dagre layout in two places: sibling subgraphs are placed in reverse
  declaration order, and depth-first back edges are reversed before ELK runs. Mermaid
  12 does neither. "Nested Subgraphs" puts the second subgraph on the left in ours and
  the first on the left in mermaid 12.1.0 and mermaid.live (horizontal 20%), and in
  "CI/CD Pipeline" mermaid 12.1.0 keeps `Fix & Retry` beside `Build Image` where ours
  puts it below `QA Approved?` (horizontal 48%). Tracked in
  [#1904](https://github.com/dfadler/zombie-mermaid/issues/1904).
- **Remaining small differences are tie-breaks.** "System Architecture", "Flowchart:
  CJK Labels" and "LR Fan-In With Bypass Edge" score 33-93% against 12.1.0, but every
  disagreeing node pair is one renderer calling two centres level (within the 20 px
  tolerance) and the other offsetting them. In "LR Fan-In With Bypass Edge" `B` sits
  above `A` and `C` in both renderers, 22 px in mermaid (12.1.0 and 12.2.0) and 15 px
  in ours, whose boxes are 37 px tall to mermaid's 48 px (#2058). In "CJK Labels"
  mermaid puts `B` about 19 px below `A`, `C` and `D`, and ours puts it 29 px above.
  The cause is not CJK text measurement: the same graph written in ASCII differs the
  same way, and without the subgraph both renderers put `B` above. It needs a subgraph
  around `A` and `B` plus the feedback edge `C --> A`, so it is where the edge's track
  sits relative to `B`, not text width (#1941). "Flowchart: Five Cluster Exit Siblings (TD)"
  agreed only after `elk.spacing.edgeEdge` was raised to 40 px for graphs with three or
  more labelled edges between the same pair (#1943).

## Known limitations (not intentional, not yet fixed)

## ER diagrams

zombie-mermaid's ER parser (`packages/mermaid-parser/src/er/parser.ts`) is a
line-oriented parser rather than mermaid.js's grammar, so it is more lenient in
some places and stricter in others.

**Unquoted labels that start with a keyword.** Everything after `:` is the label here.
mermaid.js lexes a leading `one`, `many` or `to` as a word-form cardinality keyword
and rejects the line:

| Label                                                        | mermaid.js 11.17.2 | zombie-mermaid |
| ------------------------------------------------------------ | ------------------ | -------------- |
| `one-to-one`, `many-to-many`, `one`, `many`, `to` (unquoted) | parse error        | renders        |
| `"one-to-one"`, `"many-to-many"` (quoted)                    | parses             | renders        |
| `opt-to-many` (unquoted)                                     | parses             | renders        |

Quote such labels (`: "one-to-one"`) if the source also has to work in mermaid.js
tools such as GitHub or the Mermaid Live Editor.
