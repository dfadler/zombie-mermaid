# @zombie-mermaid/ascii-layout (internal)

Layout-faithful ASCII rasterizer ("variant E") for
[#2180](https://github.com/dfadler/zombie-mermaid/issues/2180) / umbrella #2177. It draws the ELK
layout from `@zombie-mermaid/elk-layout` (#2179) on a character grid. Private, not published,
not bundled into `dist/`, and **not wired into the public API or CLI** (that is #2182); the
existing `packages/ascii-renderer` is untouched and stays the default.

It is a sibling package rather than a module inside `ascii-renderer` because it shares no code
with that renderer, depends on `elk-layout` (whose `elkjs` 0.9.3 pin must not leak into the
shipped bundle), and an internal entry in `ascii-renderer` would make that dependency part of
its graph.

```ts
import {
  renderFlowchartAscii,
  rasterizeLayout,
} from '@zombie-mermaid/ascii-layout'

const { text, boxes, stats, mergedGroups, note } =
  await renderFlowchartAscii(mmdSource)
// or, from a layout you already have: rasterizeLayout(layout, { cellW: 5, cellH: 10 })
```

`renderFlowchartAscii` throws `UnsupportedFlowchartError` for what the layout module does not
model (subgraphs, some shapes); callers fall back to the grid renderer.

## Rules

- One uniform scale, 5 x 10 px per cell, so a box is `round(w/5) x round(h/10)` cells and keeps
  mermaid's proportions (within about 4%); a box is grown only as far as its label or its edge
  lanes need (`stats.maxBoxError` reports the worst case).
- Each edge end gets its own lane: an interior cell of a face, never a corner. A tee appears on
  the border only where an edge leaves a face; an arrowhead sits in the cell just outside the
  face, aligned with its stem, and leaves the border plain.
- Routing is Dijkstra over the cell grid, pulled toward ELK's polyline; lines cross only at right
  angles, never run through a node box, and never touch a box border except at their own lane.
  If that is unroutable the gap between node groups is widened (up to 8 cells).
- Edge labels are placed best-effort on a straight run of the edge; parity with mermaid's label
  placement is not a goal.

## Face policy

`facePolicy` (`'merge-then-grow'` by default, or `'grow-only'`) decides what happens when a
face has fewer interior cells than edge ends. Identical parallel edges (same faces, direction
and arrows) are merged into one drawn line first; if the face is still short, the box grows on
that face by the minimum number of cells. Reciprocal pairs get adjacent lanes and are never
merged.

**Merged lines hide edge multiplicity**: three `A --> B` edges can render as one line.
`RasterResult.mergedGroups` lists the edge ids behind each merged line and `RasterResult.note`
carries a sentence for callers to show. Policies live in `POLICIES` in `src/rasterize.ts`.

### `grow-only`: show every edge (#2183)

`renderFlowchartAscii(src, { facePolicy: 'grow-only' })` never merges: every mermaid edge is its
own drawn line (`mergedGroups` is empty, `stats.lines === stats.edges`), and a face that lacks
lanes grows the box by the minimum cells so each edge end keeps its own lane.

**The trade-off, plainly: every edge is visible, but boxes are distorted.** Growing a face makes
the box taller or wider than mermaid drew it, so `stats.maxBoxError` is large on dense graphs
(over the flat gallery: worst box +108%, 5 of 38 samples with a box beyond 15%, against 1 for
merge-then-grow; the fixture d3, six parallel edges, is 108%). That is the expected cost of the
policy, not a failure: boxes only ever grow relative to `merge-then-grow`, never shrink. Use it
when a missing or merged line would mislead; use the default when box proportions matter more.
Graphs with no crowded face render identically under both policies.

**With `maxCols`**: the cap behaves exactly as for the default policy. It compresses blank gaps
only and never touches the (already grown) boxes, so the grown boxes are fixed before the cap
acts and the cap cannot make them worse. Because grown boxes can be wider, the boxes alone may
exceed the cap sooner; then the result is the uncapped render with `capped: false`
(`stats.naturalCols === stats.cols`), same as before.

Routing note: a dense face puts lanes in adjacent cells. If shortest-first routing cannot place
every line at a given gap, the router retries longest-first before widening the gap, so
grow-only stays free of overlaps (the default policy's output is unchanged by this).

## Column cap

`maxCols` (default `DEFAULT_MAX_COLS` = 120; `Infinity` disables) caps the width by shrinking the
blank gaps between node groups on the horizontal axis (`stats.gapKept` is the kept fraction,
bisected to the largest that fits). That axis is the rank gap in LR/RL and the node gap within a
rank in TD/BT: width is what is capped, so it is always the x axis. Boxes are never scaled, so
sizes, lanes, line count and merged groups are identical to the uncapped render; routing still
widens a gap when edges would not route (up to 8 cells), and the integrity checks run on the
compressed output.

**When the cap cannot be met** (the boxes plus the minimum routable gaps exceed it, e.g. a 5-node
LR chain of 30-cell boxes) the result is the uncapped render with `capped: false`, and
`stats.naturalCols === stats.cols`. The rasterizer never emits a half-compressed render that still
misses the cap; the caller (#2182) decides: fall back to the grid renderer, or show the wide text.
`naturalCols` is also set when compression happened, to report the before width.

## Tests

`pnpm exec vitest run -c config/vitest.config.ts packages/ascii-layout`. No Chromium. Goldens
are `__tests__/fixtures/*.ascii.txt` (`*.grow-only.ascii.txt` for the grow-only policy) for the elk-layout fixture sources (d1-d3 are the dense
duplicate, reciprocal and self-loop cases, **with node declarations**: declaration order moves
mermaid's layout). There is no SVG golden because this path produces characters only; the SVG
renderer is unchanged. Property tests check, on the text and box rectangles alone (not on the
rasterizer's own bookkeeping): border integrity, arrowhead adjacency and stem, right-angle-only
crossings, and box error under 15% for the fixtures.

`pnpm exec tsx scripts/ascii-layout-table.ts [--show] [--policy=grow-only]` prints the measured table over the flat
gallery samples.
