# @zombie-mermaid/ascii-renderer

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
