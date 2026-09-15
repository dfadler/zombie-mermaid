---
'@zombie-mermaid/ascii-renderer': patch
---

Fix two ASCII edge-routing structural-fidelity bugs found by the weekly
form-judge audit (#1067):

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
