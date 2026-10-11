---
title: Making the ASCII Renderer Faster, and What We Could Actually Measure
date: 2026-10-10
description: Flowchart ASCII time in the weekly benchmark history climbed from 109 ms to 306 ms in two weeks. A run of perf PRs followed, and the history file stopped before any of them landed. Here is what each PR did, what its own description measured, and what a before/after run on one machine says.
---

The weekly benchmark history (`bench-history.jsonl`) has four entries. In
the ASCII column, the Flowchart category went from 49.7 ms (2026-09-14) to
108.9 ms (2026-09-21) to 124.7 ms (2026-09-28) to 306.0 ms (2026-10-05), over
the same 24 flowchart samples. Parse time and SVG time stayed flat within
noise over the same weeks. Issue [#1425](https://github.com/dfadler/zombie-mermaid/issues/1425)
quotes the 109 to 306 ms stretch as the reason to add a dedicated large-diagram
benchmark.

That is where this story starts. What follows is a list of the performance
work that landed afterwards, with one rule: every number is attributed to
where it came from, and the ones I could not check are marked.

## The ordering problem

The last history entry is dated 2026-10-05, 21:44 UTC. Every PR below merged
after that: [#1351](https://github.com/dfadler/zombie-mermaid/pull/1351) on
10-06, the rest between 10-08 and 10-10. So the history file contains the
climb and none of the fixes. It cannot tell you whether the work helped.
Anything claimed from it would be a guess, so this post does not claim
anything from it.

## What landed

Each row is a PR description's own claim, from that PR's author, measured on
whatever machine that PR was written on. They are not comparable with each
other.

- **[#1454](https://github.com/dfadler/zombie-mermaid/pull/1454), `Grid`
  occupancy uses numeric keys** (issue #1424). Replaces a `"x,y"` string built
  per `has` call. The PR reports the slowest sample ("CI/CD Pipeline") at 111.5
  ms before and about 93 ms after, and the sum of all sample renders about 14%
  faster. It also reports that the large generated graphs did not move, which
  is the useful part: the large-graph cost was somewhere else.
- **[#1450](https://github.com/dfadler/zombie-mermaid/pull/1450), a
  large-diagram scaling benchmark** (issue #1425). `pnpm run bench:scaling`
  renders generated 100/200/300-node flowcharts. It is report-only and not in
  the CI gate, because multi-second renders are too noisy to gate on. Its first
  run found the super-linear ASCII growth: 203 ms at 100 nodes, 727 ms at 200,
  1640 ms at 300, with parse and SVG staying small.
- **[#1472](https://github.com/dfadler/zombie-mermaid/pull/1472), scan only
  the touched part of per-edge layers** (issue #1458). A CPU profile of a
  200-node render showed time going to GC and to rescanning full-size canvas
  layers, one set per edge. Layers now track the box of cells written.
- **[#1482](https://github.com/dfadler/zombie-mermaid/pull/1482) and
  [#1487](https://github.com/dfadler/zombie-mermaid/pull/1487), share blank
  columns across per-edge layers** (issues #1478 and #1458). Both describe the
  same technique: a layer is an array of one shared blank column, copied on
  first write. They landed a day apart. #1482 reports a 200-node render's heap
  going from about 468 MB to 37 MB; #1487 reports about 470 MB to 50 MB on its
  own run. That is two independent measurements of one effect, and the two PRs
  describe the same change, so I count it once.
- **[#1473](https://github.com/dfadler/zombie-mermaid/pull/1473), memoise
  label placement per call** (issue #1466). Label placement was doing roughly
  cubic work in the number of labelled edges. The PR reports, for 29 edges,
  5814 ms before and 119 ms after, with output unchanged.
- **[#1484](https://github.com/dfadler/zombie-mermaid/pull/1484), cache
  `pathToDrawing` per draw scope** (issue #1458). A dense 40-node, 111-edge
  labelled flowchart went from about 17.7 s to about 0.67 s per the PR, and
  the PR itself notes the sparse generated graphs did not benefit.
- **[#1498](https://github.com/dfadler/zombie-mermaid/pull/1498), index
  drawn segments by row in `besideGeometryFree`** (issue #1490). The PR
  reports 683 ms to 465 ms at 40 edges, about 30%, and states that its own
  acceptance target (well under 1 s at 80 labelled edges) is only partly met.
- **portShifts computed once per `drawGraph`** (issue #1350). This is a
  commit, `df685c09`, inside [#1351](https://github.com/dfadler/zombie-mermaid/pull/1351),
  a layout fix for edges sharing a port. It was a perf fix for a slowdown
  inside that PR's own branch: the commit message says a gallery test timed out at 6.4
  s against 2.7 s on main, because label placement recomputed an O(E^2)
  `portShifts` for every candidate. No before/after number was recorded for
  the fix itself. **Unmeasured.**

Two PRs sit outside that list but are in the code the numbers below measure.
[#1481](https://github.com/dfadler/zombie-mermaid/pull/1481) (issue #1474)
makes `getPath` fail fast when the target cell is sealed instead of flooding
the open area up to the 50k-iteration cap; its PR gives no timing. And
[#1427](https://github.com/dfadler/zombie-mermaid/pull/1427)
made A* faster (numeric map keys, `push` plus `reverse`) and merged on 10-08
(146 ms to 105 ms on the slowest sample, per its description).

## A before and after on one machine

Per-PR numbers from different machines do not add up, so I ran the existing
benchmarks myself, back to back, on one laptop under normal load. Three runs
of `pnpm run bench` at each commit, median reported, Node 22.

| commit         | what it is                             | Flowchart ASCII, 24 samples (ms)    |
| -------------- | -------------------------------------- | ----------------------------------- |
| `7a4925a3`     | the 10-05 history entry's commit       | 439.6, 391.3, 1048.8 (median 439.6) |
| `5b4f5889`     | after #1351, before any other PR above | 336.8, 313.6, 377.1 (median 336.8)  |
| `ccad43e9`     | after #1472                            | 170.6, 161.5, 160.0 (median 161.5)  |
| `9b4f8039`     | after #1481 (includes #1473)           | 35.3, 30.8, 74.0 (median 35.3)      |
| current `main` | includes all of the above              | 39.1, 39.6, 66.4 (median 39.6)      |

The 1048.8 and 74.0 and 66.4 readings are the machine being busy; I report
them rather than dropping them. The medians are the figures to look at.

On this machine the Flowchart ASCII time fell by about 10x from the 10-05
commit to current `main`. The CI runner is a different machine, so these are
not the same numbers as the history file (306 ms there, about 440 ms here for
the same commit), and the ratio is the claim, not the absolute value.

What the table does not say is which PR caused which drop. Between `5b4f5889`
and `ccad43e9` the code changes were several PRs, not only the perf ones, and
between `ccad43e9` and `9b4f8039` there are two code changes: the label
memo (#1473) and the sealed-target guard (#1481). I did not bisect further.
The large drop at the end is therefore attributable to one of those two, or
both, and I will not pick one.

The scaling benchmark, `pnpm run bench:scaling --runs=3`, comparing
`5b4f5889` with current `main` (the script copied onto the older commit):

| nodes | ASCII before (ms) | ASCII now (ms) |
| ----- | ----------------- | -------------- |
| 100   | 272.4             | 41.1           |
| 200   | 1031.9            | 177.2          |
| 300   | 3282.4            | 434.5          |

Still super-linear: roughly 4.3x going from 100 to 200 nodes, 2.4x from 200
to 300. The scaling curve is flatter and the constants are lower, which is
not the same as solved.

`pnpm run bench:label-placement` on current `main` gives 3505 ms at 80
labelled edges (and 460 ms at 40). The #1466 research doc recorded 13,614 ms
at 80 labelled edges earlier the same week, on another run. That is roughly a
4x improvement across two sessions, and the #1490 goal of getting that case
well under one second has not been met.

## What this does and does not show

- Flowchart ASCII on the repo's benchmark samples is much faster than it was
  at the 10-05 commit, on the one machine where I could compare.
- It is not true that the renderer is "faster overall" in a way the history
  file will show yet. The next weekly entry will be the first with any of
  these fixes in it.
- Parse and SVG were not the problem and were not touched.
- Large and label-heavy graphs are still slow in absolute terms.

If the next weekly entry does not show a drop of a similar size, the first
thing to check is whether the CI runner's variance is hiding it, since the
history records one run per week and no spread.
