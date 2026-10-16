---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'zombie-mermaid': patch
---

Class diagrams now honour `direction TB|TD|LR|RL|BT`, which the parser accepted and ignored (every class diagram was laid out top-down). SVG: all four directions, as mermaid.js lays them out (12.1.0 and 12.2.0 agree): `LR` puts each level in a column, `RL` mirrors it, `BT` flips the stack; markers, cardinalities, namespace frames, notes and lollipop names follow the new axis. ASCII: `BT` is drawn (the top-down drawing flipped, boxes kept upright, a namespace title kept on the top border, a note one rank below its class); `LR` and `RL` stay top-down, because the ASCII class layout is built from stacked level rows end to end, and this is documented in `docs/diagrams.md` and `docs/known-differences.md`. `ClassDiagram` gains an optional `direction` field. `RenderOptions.direction` still does not apply to class diagrams. Output change: SVG for class diagrams that declare `direction LR`, `RL` or `BT`, and ASCII for those that declare `BT`; every other diagram, and class diagrams with no direction line or `TB`/`TD`, are byte-identical (checked by hashing every gallery sample and ASCII testdata input, SVG and both ASCII charsets, before and after). Layout oracle for class samples unchanged, and the three new direction samples score 100% against mermaid 12.1.0. Refs [#2116](https://github.com/dfadler/zombie-mermaid/issues/2116); ASCII `LR`/`RL` are tracked in [#2158](https://github.com/dfadler/zombie-mermaid/issues/2158).

Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, layout and glyph changes are not documented output contracts, no option semantics change (the render-time `direction` option is deliberately left ignored for class diagrams) and the new type field is optional; it fixes a parity gap, like #2135.
