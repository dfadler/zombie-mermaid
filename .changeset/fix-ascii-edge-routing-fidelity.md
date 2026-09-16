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
- A cell overlap between two unrelated edges could be hidden by a *third*
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
