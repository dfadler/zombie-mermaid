# @zombie-mermaid/ascii-renderer

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
