# ArchiMate: lower to the flowchart model, not a dedicated renderer

Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). The C4
half of that issue made the same choice for C4 (see the C4 PR); this records
it for ArchiMate, where the trade is less obvious because ArchiMate's notation
is richer than a flowchart's.

## Context

Mermaid has no ArchiMate diagram. Adding one is an open request ([mermaid-js/mermaid#4007](https://github.com/orgs/mermaid-js/discussions/4007)),
so there is no Mermaid syntax to be compatible with. The only prior art is
upstream `lukilabs/beautiful-mermaid`:

- [#34](https://github.com/lukilabs/beautiful-mermaid/pull/34)
  (kristjanakkermann, authored with Claude, unmerged) invented the
  `archimate-layered` DSL: layer blocks (`business:`, `application:`, ...),
  `type "Label" as alias` element lines, and `a -->|type| b` relationships. Its
  implementation is a parser, a dagre layout with invisible layer-ordering
  edges, a 425-line SVG renderer with eleven hand-drawn relationship markers,
  and a 539-line separate ASCII renderer.
- [#71](https://github.com/lukilabs/beautiful-mermaid/pull/71) (Victor Palma,
  `devx`, unmerged) bundles #34's code with test fixtures and a repo-wide
  reformat. Its tests exercise the bespoke renderer with hand-positioned data.

The vocabulary comes from the ArchiMate 3.2 specification (The Open Group):
seven layers/aspects (strategy, motivation, business, application, technology,
physical, implementation and migration), 44 distinct element types, and eleven
relationship types. The DSL is kept unchanged so upstream's fixtures and any
source written for it still parse.

## Decision

Parse `archimate-layered` in `@zombie-mermaid/mermaid-parser`
(`parseArchimate`), lower it to a `MermaidGraph` (`archimateToGraph`), and render
it with the existing flowchart layout and renderers in both SVG and ASCII. No
ArchiMate-specific layout or renderer code.

- Each layer is a subgraph "band"; elements are nodes; relationships are edges.
- Layers stack in the canonical order strategy, motivation, business,
  application, technology, physical, implementation. An invisible edge joins
  the first element of each present layer to the first of the next. A
  relationship that runs against that order (technology serves application) is
  emitted reversed with its arrowhead on the source end, so no real edge
  pulls a layer out of position while the arrow still points at the true
  target.
- Elements carry the layer's ArchiMate colour and a `«Type»` line (qualified,
  e.g. `«Business Service»`, only where the bare name exists in several
  layers). Shapes approximate the notation: services are stadiums, behaviour
  elements rounded, artifacts cards, and so on.
- Relationships are told apart by line style (dotted for realization, access,
  influence, flow) and a label naming the type. Association is the plain,
  unlabelled line.
- ASCII draws no bands (below), so layers there read from vertical order and the
  qualified `«Type»` line.
- Unlike upstream, which silently drops lines it does not understand, every
  malformed statement throws with its line number.

## Consequences

- **Notation fidelity is lower than upstream's renderer.** The flowchart edge
  model has no diamond, hollow-triangle or dot terminators, so composition,
  aggregation, specialization and assignment are not drawn with their
  ArchiMate markers, and there are no element icons. The eleven types stay
  unambiguous through the label. Markers would need a new terminator kind in
  the shared edge model, which every flowchart renderer path would then have to
  honour; that belongs in its own change if wanted.
- **Direction is lost on arrowless relationships.** Composition and aggregation
  draw no arrowhead, so which end is the whole is not shown.
- **ASCII has no layer bands.** The ASCII grid layout mis-places nodes when
  sibling subgraphs are joined by cross-subgraph edges (a node is drawn inside
  the wrong box, or layout throws). This is a pre-existing limitation of that
  engine, reproducible with a plain flowchart of two subgraphs and a chain
  through both. The ASCII path therefore lowers without subgraphs.
  Dense diagrams can also draw edges through nodes, as flowcharts do.
- **Layer order is a strong hint, not a guarantee.** It rests on invisible edges
  and reversed upward edges; a diagram with many cross-layer cycles may still
  place a layer out of order.
- **Any known element type is accepted in any layer block**, matching upstream
  (`service` under `technology:`, `node` under `business:`). Not validated
  against the ArchiMate metamodel; nor are relationship source/target pairs.
- **No second layout engine to maintain**: themes, `direction`, curve styles,
  accessible names, `click` styling hooks and future flowchart layout fixes
  apply to ArchiMate for free. The cost above is the price.
- **Rejected alternative: port #34's renderer.** It would satisfy the marker
  assertions in #71's tests, but it predates the registry and the package
  split, uses dagre (a second layout engine alongside ELK), and has a separate
  hand-written ASCII renderer. Those tests are ported with the marker-specific ones marked
  `it.skip` and the reason recorded.
