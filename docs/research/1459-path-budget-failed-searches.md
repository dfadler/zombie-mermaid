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
  counted iterations total only 150,325, so some of that sample's work is not
  covered by these counters, e.g. a second layout pass).
- All 3 cap-hits are in one sample, **CI/CD Pipeline** (12 ok / 4 failed,
  150,001 failed iterations). Every other sample uses under 1,000 iterations.
- The slowest successful search in the whole corpus took 80 iterations. A cap-hit is therefore never a "slightly too small
  limit"; those searches are unreachable or effectively unreachable targets
  that A\* floods the grid looking for.

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

Follow-up worth filing if CI/CD Pipeline's cost matters: find out why those 3
edges are unreachable and short-circuit them (a cheap reachability check, or
fixing the endpoint choice) rather than tuning the caps. That removes the
waste without touching the limits.
