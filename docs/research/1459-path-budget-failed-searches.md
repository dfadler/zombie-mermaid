# Path-budget iterations spent on failed searches (#1459)

Remaining half of #1424. Question: how much of the render-wide A\* budget
(`DEFAULT_PATH_BUDGET` = 200,000 in `packages/ascii-renderer/src/pathfinder.ts`)
is burned by searches that never find a path?

## Method

Temporary, unshipped counters in `getPath` (success: iterations at goal;
failure: iterations at heap-empty, per-call cap `MAX_ITERATIONS` = 50,000, or
budget exhaustion), then `renderMermaidASCII` over every sample in
`packages/site/samples-data.ts` (116 samples; 36 reach `getPath`, the rest are
non-flowchart/state types). Measured 2026-10-09 on `main` (0d61de15).

## Results

| Outcome   | Searches | Iterations |
| --------- | -------: | ---------: |
| Succeeded |      274 |      1,526 |
| Failed    |        6 |    150,003 |

- Failures are 99.0% of all iterations spent, in 6 of 280 searches.
- Of the 6 failures: 3 hit the per-call 50,000 cap; the other 3 ended after a
  single iteration (empty frontier). A separate counter saw the render-wide
  budget run out once, in the same sample (cause not investigated; the
  counted iterations total 151,529 (1,526 + 150,003), short of the 200,000
  budget, so some of that sample's work is not covered by these counters,
  e.g. a second layout pass).
- All 3 cap-hits are in one sample, **CI/CD Pipeline** (12 ok / 4 failed,
  150,001 failed iterations). Every other sample uses under 1,000 iterations.
- The slowest successful search in the whole corpus took 80 iterations. A cap-hit is therefore never a "slightly too small
  limit". Follow-up investigation (#1474) found the cause:
  `rerouteAroundStyleConflicts` temporarily reserves the only free neighbour of
  an endpoint's port cell, so the target (or start) is sealed for that retry
  and A\* floods the open grid until the cap. The edges are reachable on the
  first routing pass; which three calls were the cap-hits was not attributed
  per call (the `C -> E` runs against a sealed target are the likely ones).

## Decision

Don't change the code in this issue. Lowering `MAX_ITERATIONS` (say to 5,000,
still 60x the longest observed success) would cut CI/CD Pipeline's cost by
about 10x and would not affect any success in the corpus (not re-rendered to confirm), but it
tops out at 80-iteration successes, so it says nothing about tall or wide
real-world diagrams where a legitimate route may need thousands of
iterations. Lowering it blind risks silently degrading routing for those, which
is a worse failure than the current bounded slowness. The render-wide budget
(200,000) stays as the hard ceiling, and
only one corpus render reaches it.

Follow-up: #1474 tracks the fix (skip conflict cells that are an endpoint's
only entry or exit, and return `null` from `getPath` when the target has no
free neighbour) rather than tuning the caps. That removes the waste without
touching the limits.
