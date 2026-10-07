# ASCII vertical edge-label placement vs. Mermaid (#1385)

## Context

[#1385](https://github.com/dfadler/zombie-mermaid/issues/1385) asked whether
the ASCII renderer's label placement on a vertical edge (the label one blank
cell beside the stroke, per #1284/#1332) is a faithful analogue of how
Mermaid draws a labelled edge, or a workaround that moved away from it.

`pnpm run label:oracle` (`scripts/label-position-oracle.ts`) measures it.
"Along" is the label centre's position between the two nodes' facing sides
(0 = source end, 1 = target end); "across" is its offset from node A's
centre line (px in Mermaid, cells in ASCII). Measured against mermaid.js as
pinned in `package.json`:

| Case                         | Mermaid along / across | ASCII along / across |
| ---------------------------- | ---------------------- | -------------------- |
| TD `A -->\|push = build\| B` | 0.50 / 0 px            | 0.33 / 8.5 cells     |
| TD one-word label            | 0.50 / 0 px            | 0.33 / 3.5 cells     |
| LR `A -->\|push = build\| B` | 0.50 / 0 px            | 0.43 / 0 cells       |
| TD reciprocal pair, A to B   | 0.50 / -24 px          | 0.67 / 5.5 cells     |

For the ASCII TD case the gap between the boxes is five stroke rows; the
label is on the second, the midpoint would be the third.

## Decision

Answers to the questions in the issue:

1. **Horizontal position (beside the stroke): real, and kept.** Mermaid
   centres the label on the line and hides the line behind an opaque label
   background. A terminal has no background fill: the closest equivalent is
   to replace the stroke cells under the label, which on a vertical edge
   cuts the line into two stubs joined only by a text row, the exact
   defect #1332 fixed. The LR case already is the closest-to-Mermaid
   form (label on the line, `├push = build─►`, 0 cells across), because
   there the stroke runs along the text. So the divergence is specific to
   vertical edges, where beside-the-stroke is the correct analogue and
   not a regression. Reverting #1332 is not recommended.
2. **Vertical position: real, and worth fixing for a lone edge.** Mermaid
   puts the label at the midpoint (0.50). ASCII puts a lone down edge at
   0.33. The only reason for the offset is #530 (reciprocal pairs sharing a
   channel need their labels apart and next to their own arrowheads), and
   `labelTextPlacement` already switches on `pullTowardTarget` for that
   case. A lone edge has no partner to avoid, so the near-source offset
   buys it nothing. Recommendation: for an edge with no reciprocal partner,
   use the gap midpoint. Reciprocal pairs stay as they are (their 0.67 is
   the deliberate #530 spread, and Mermaid also separates them sideways).
3. **Reading the edge: not a separate defect.** Association by proximity is
   the same problem #1338's guard already handles; centring the row does
   not change it.
4. **Horizontal (LR) edges: not affected.** Label on the line, along 0.43
   (close to Mermaid's 0.50; the label is drawn on the line). **Fan-out edges: not comparable.** Mermaid draws a
   diagonal or curve and puts the label at its midpoint; ASCII routes
   fan-out through a shared gutter row, so "along the edge" has no common
   definition. Out of scope.
5. **Objective check: yes.** `pnpm run label:oracle` is the small extension
   the issue asked for. It compares label position to Mermaid's by along /
   across, not by eye.

## Consequences

- Candidate 3 of the issue (leave as is) is ruled out for the vertical
  row only; candidate 2 (draw on the stroke and break it) is ruled out for
  vertical edges, per point 1. Candidate 1 (beside the stroke, at the
  midpoint) is what to pursue.
- A trial change (no offset when `pullTowardTarget` is false) was tried and
  discarded: it moved two existing goldens,
  `ascii-fan-out-upstream-113.test.ts` (the `left*`/`right*` labels on a
  cluster fan-out land on different rows from `center*`) and
  `ascii-bt-label-order.test.ts` (a BT/TD hyphenated-label comparison). So
  the follow-up needs to decide fan-out siblings (keep them on a shared
  row) and BT symmetry explicitly, and update every affected case with both
  SVG and ASCII snapshots. It also needs the real-terminal before/after
  captures (`verify-ascii-terminal`) with the Mermaid source inline. That
  work is tracked in its own issue, not done here.
- The oracle measures a handful of hand-picked cases, not every sample.
