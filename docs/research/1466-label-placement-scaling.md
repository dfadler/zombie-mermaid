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

Label cost grows 9x, then 18x, per doubling: worse than cubic. The unlabelled twin is
also superlinear (4.1, 11.6, 50.6 ms: ~2.8x then ~4.4x per doubling) but stays tiny
beside the label cost.

## Call counts (temporary counters, not committed)

| N   | `resolveLabelPlacement` calls | uncached resolutions (memo on) | time, memo on | time, memo off |
| --- | ----------------------------: | -----------------------------: | ------------: | -------------: |
| 5   |                         3,590 |                            446 |         29 ms |         248 ms |
| 10  |                        29,570 |                          1,806 |         86 ms |          4.5 s |
| 20  |                       238,730 |                          7,226 |        757 ms |           92 s |

(Memo-off timings include counter overhead.) Calls grow ~8x per doubling (cubic), unique
resolutions ~4x (quadratic). The #1473 memo removes repeated resolution work (~100x at
N=20) and is worth keeping, but the call count itself is still cubic.

## Where the time goes

`node --cpu-prof` at N=28: `besideGeometryFree` is ~2.6 s self time of ~3 s total.
`resolveLabelPlacement`, `pathToDrawing` and everything else are each under ~50 ms self
time. The cost is the scan inside `besideGeometryFree` itself
(`packages/ascii-renderer/src/draw-arrows.ts`): for every candidate placement it loops
over every other edge, calls `pathToDrawing(graph, other)`, and tests every segment of
that path. That is placements x edges x segments per resolution, on top of the cubic call
count above.

## Conclusion

1. The scaling problem is real for the #1463-shaped worst case: 80 labelled edges take
   ~13.6 s. Typical diagrams are small (20 labelled edges: 90 ms).
2. Layout-scoped caching of placements is not the remaining lever: placements are already
   memoised per call and the memo is dropped on exit, so it cannot go stale.
3. Caching `pathToDrawing` per layout alone is unlikely to be enough: its self time is
   under ~50 ms, so it removes only the allocation, not the segment scan. The lever is the
   `besideGeometryFree` scan: precompute each edge's drawn segments (or bounding boxes)
   once per layout and skip edges whose box cannot reach the candidate cell. Tracked in a
   follow-up issue; #1458's `pathToDrawing` cache is a prerequisite for the per-layout
   precompute, not the fix. Re-run the benchmark above to verify (target: N=40 well under
   1 s).

No renderer code is changed by this write-up.
