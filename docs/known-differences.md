# Known differences from mermaid.js

Places where zombie-mermaid renders or parses differently from mermaid.js and the
difference is either intentional or not yet fixed. The reference is the pinned
`mermaid` devDependency (12.1.0), rendered headless through
`scripts/lib/real-mermaid.ts`; mermaid.live and GitHub render the same layout.
The pin moved from 11.17.2 in the bump that added this note, and entries not
listed below as re-checked were measured on 11.17.2: other versions may differ.

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

ELK (our layout engine) and the dagre-based layout in mermaid.js break layout ties
differently, so node order within a layer, and cross-axis offsets between layers, can
differ even when both assign the same layers.

- **Mirrored vertical order.** In the "Labeled Fan-In (LR)" sample, mermaid.js
  stacks `C` above `A` above `B`; zombie-mermaid places `B` above `C` above `A`. Layers
  match. ELK follows source order as its crossing-minimization tie-break
  (`elk.layered.considerModelOrder.strategy: NODES_AND_EDGES`, set in
  `packages/svg-renderer/src/layout-engine/to-elk.ts`); mermaid.js does not. This is
  intentional and is why that sample scores low in the
  [layout-fidelity scorecard](layout-fidelity-scorecard.md) (a handful of nodes, so
  one flipped pair moves the percentage a lot).

## Known limitations (not intentional, not yet fixed)

- **Late sink layer when edges are labeled.** In the "Decision Tree" sample,
  `Go outside` (`C`) lands one layer below `Have umbrella?` (`B`) in our SVG, with
  the edge labels present; mermaid.js puts them in the same layer. Removing the
  labels from the source puts `C` back beside `B`. Edge labels are the trigger,
  not node shapes.

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
