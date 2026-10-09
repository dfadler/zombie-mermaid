# Label-placement scaling measurement (#1466)

Issue: <https://github.com/dfadler/zombie-mermaid/issues/1466>. Benchmark:
`pnpm run bench:label-placement` (`scripts/bench-label-placement.ts`, added in #1473).
This file holds the raw numbers and the conclusion.

## Workload

LR flowchart, N nodes `S0..S(N-1)`, each with a labelled edge to a shared `Sink` and to a
shared `Hub`, plus a chain `S(i-1) --> Si`: 2N labelled edges on shared vertical legs (the
#1433/#1463 shape). The "unlabelled" twin is the same graph with labels stripped, so the
difference is label-placement cost (layout is identical). Medians of 3 runs,
`colorMode: 'none'`, Node 22, Apple silicon.

## Results (main, includes the #1473 per-call memo)

| N (labelled edges = 2N) | labelled ms | unlabelled ms | label cost ms |
| ----------------------- | ----------: | ------------: | ------------: |
| 10 (20)                 |          90 |           4.1 |            86 |
| 20 (40)                 |         782 |          11.6 |           771 |
| 40 (80)                 |      13,614 |          50.6 |        13,563 |

Label cost grows 9x, then 18x, per doubling: worse than cubic. The unlabelled twin stays
near-linear, so the growth is entirely label placement.

## Call counts (temporary counters, not committed)

| N   | `resolveLabelPlacement` calls | uncached resolutions (memo on) | time, memo on | time, memo off |
| --- | ----------------------------: | -----------------------------: | ------------: | -------------: |
| 5   |                         3,590 |                            446 |         29 ms |         248 ms |
| 10  |                        29,570 |                          1,806 |         86 ms |         4.5 s  |
| 20  |                       238,730 |                          7,226 |        757 ms |          92 s  |

(Memo-off timings include counter overhead.) Calls grow ~8x per doubling (cubic), unique
resolutions ~4x (quadratic). The #1473 memo removes repeated resolution work (~100x at
N=20) and is worth keeping, but the call count itself is still cubic.

## Where the time goes

`node --cpu-prof` at N=28: `besideGeometryFree` is ~2.6 s self time of ~3 s total.
`resolveLabelPlacement`, `pathToDrawing` and everything else are each under ~50 ms. The
beside-stroke geometry check dominates, not label resolution itself.

## Conclusion

1. The scaling problem is real for the #1463-shaped worst case: 80 labelled edges take
   ~13.6 s. Typical diagrams are small (20 labelled edges: 90 ms).
2. Layout-scoped caching of placements is not the remaining lever: placements are already
   memoised per call and the memo is dropped on exit, so it cannot go stale. The remaining
   cost is `besideGeometryFree` re-deriving drawing-space paths.
3. Next optimisation: cache `pathToDrawing` per layout (not keyed on `AsciiEdge` identity
   alone). That work is tracked under #1458; re-run the benchmark above against it to verify
   the gain (target: N=40 well under 1 s).

No renderer code is changed by this write-up.
