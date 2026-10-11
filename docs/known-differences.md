# Known differences from mermaid.js

Places where zombie-mermaid renders or parses differently from mermaid.js and the
difference is either intentional or not yet fixed. Each entry was re-checked against
the pinned `mermaid` devDependency (11.17.2), rendered headless through
`scripts/lib/real-mermaid.ts`. Other mermaid versions may differ.

## Subgraph inner direction

mermaid.js flips a subgraph's inner direction perpendicular to its parent by default
(`graph TD` parent, row inside; `graph LR` parent, column inside). An edge that
touches a node _inside_ the subgraph cancels the flip, and an explicit `direction` is
then ignored. Edges to or from the subgraph id (`X --> Sub`, `Sub --> Y`) do not cancel
it. Outside edges do not cause the flip; it is the default.

zombie-mermaid never applies the default flip. It honors an explicit `direction`
only when no edge crosses the subgraph boundary (an edge with exactly one end inside
the subgraph, where its id counts as inside), and otherwise uses the parent's
direction. Edges between two inner nodes, like `a --> b`, never cancel it. SVG and ASCII agree with each other. Given `subgraph S` holding
`a --> b --> c` in a `graph TD`:

| Source                                      | mermaid.js inner | zombie-mermaid |
| ------------------------------------------- | ---------------- | -------------- |
| no `direction`, no edges                    | row              | column         |
| `direction LR`, no edges                    | row              | row            |
| `direction TB`, no edges                    | column           | column         |
| `graph LR` parent, no `direction`, no edges | column           | row            |
| `X --> S` or `S --> Y` (edge to the id)     | row              | column         |
| `direction LR` plus `X --> S`               | row              | column         |
| `X --> a` (edge to an inner node)           | column           | column         |
| `c --> Y` (edge from an inner node)         | column           | column         |

The rows that differ are an isolated subgraph with no `direction`, and a subgraph
touched only by edges to or from its id. To get the same result in both, set
`direction` explicitly and keep edges off the subgraph id, or accept the difference.
Nested subgraphs and cluster-to-cluster edges were not checked.

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
