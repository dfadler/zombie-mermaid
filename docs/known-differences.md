# Known differences from mermaid.js

Places where zombie-mermaid renders or parses differently from mermaid.js and the
difference is either intentional or not yet fixed. Each entry was re-checked against
the pinned `mermaid` devDependency (11.17.2), rendered headless through
`scripts/lib/real-mermaid.ts`. Other mermaid versions may differ.

## Subgraph inner direction (ASCII only)

mermaid.js lays out a flowchart subgraph that no edge crosses as its own graph,
perpendicular to its parent (`graph TD` parent, row inside; `graph LR` parent, column
inside), unless the subgraph sets `direction`. A subgraph an edge crosses stays in the
parent's layout and its `direction` is ignored. An edge crosses when exactly one end is
inside the subgraph, counting nodes and nested subgraph ids but not the subgraph's own
id: `X --> Sub` and `Sub --> Y` do not cross. Nesting repeats the rule: in a
`graph TD`, an outer subgraph lays out as a row and the subgraph inside it as a column.
A subgraph an edge crosses does not start a new level, so its children flip relative
to the direction it inherits.

SVG follows this rule (#1699), checked against mermaid 11.17.2 for explicit and
default directions, `TD`/`LR`/`BT`/`RL` parents, edges to and from the id, edges to a
member, nested subgraphs and cluster-to-cluster edges
(`src/__tests__/subgraph-default-flip-1699.test.ts`).

ASCII does not flip. It honors an explicit `direction` only when no edge crosses the
boundary, counting the subgraph's own id as inside, and otherwise uses the parent's
direction. Flipping by default there is blocked by the ASCII grid: two sibling
subgraphs with different inner directions share one grid and overlap
(`graph LR` with two unconnected subgraphs already renders garbled with an explicit
`direction TB` in each). Given `subgraph S` holding `a --> b --> c` in a `graph TD`:

| Source                                      | mermaid.js / SVG | ASCII  |
| ------------------------------------------- | ---------------- | ------ |
| no `direction`, no edges                    | row              | column |
| `graph LR` parent, no `direction`, no edges | column           | row    |
| `X --> S` or `S --> Y` (edge to the id)     | row              | column |
| `direction LR` plus `X --> S`               | row              | column |

Other rows agree: `direction LR` or `TB` with no edges, `X --> a` and `c --> Y`.

One SVG gap remains: an edge between a member and its own subgraph (`a --> S`)
crosses in mermaid.js, but is dropped before layout here (#1310), so the subgraph
still flips.

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
