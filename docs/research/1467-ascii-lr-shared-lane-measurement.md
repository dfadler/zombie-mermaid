# #1467: LR edges sharing a lane into one node — measurement

Research only; no renderer change. Answers the two things #1467 says nobody has
measured: how the router decides to put these edges on one lane, and how many
existing samples a "one lane/drop per edge" change could touch.

## How the edges end up merged

- **Not bundling.** `analyzeEdgeBundles` (`packages/ascii-renderer/src/edge-bundling.ts`)
  returns `[]` unless the graph direction is `TD` ("LR routing handles merging
  naturally"). In the #1467 repro no edge has `edge.bundle` set, so
  `draw-bundles.ts` is not involved.
- **It is an emergent property of A\*.** Each edge is routed independently by
  `determinePath` (`edge-routing.ts`) calling `getPath` (`pathfinder.ts`). Step
  cost is a uniform 1 (plus a 0.001 bend tie-break only under `preferStraight`),
  and only node boxes are reserved in the grid (`reserveSpotInGrid`); drawn edges
  are not obstacles and are not penalised. So when several edges with the same
  target have equal-length routes, they pick the same cells: the same
  under-row lane and the same final drop into the target's bottom port.
- **Only same-source-and-target edges get lanes.** `assignParallelEdgeLanes` /
  `buildParallelLanePath` give true parallels (same source AND target) distinct
  offset lanes. Edges from different sources into one node (`A->D`, `B->D`,
  `C->D`) are not a parallel group, so nothing separates them.

So option (a) "one lane/drop per source edge" is not a tweak to a bundling
decision; it needs a new notion in the router (an edge-occupancy cost in
`getPath`, or a per-target port/lane allocator), which is a layout change for
every LR (and TD) graph with fan-in.

## How many samples a lane split could change

Method: for each `graph`/`flowchart` sample in `packages/site/samples-data.ts`
(29 of them; 14 LR) plus the #1467 repro, run `parseMermaid` ->
`convertToAsciiGraph` -> `createMapping`, expand each `edge.path` to cells, and
for every pair of edges with the same target (or the same source) but different
other endpoint, count cells they share after trimming the first/last 2 cells at
the common port. A pair with at least 2 shared cells counts as "sharing a lane".
This is a crude upper bound: it counts any shared run, not only ones that make
a label unattributable. Pairs inside one `EdgeBundle` were excluded (none found).
Other diagram types and the unit-test corpus were not scanned.

| Corpus          | Flowcharts | With a shared run                                     |
| --------------- | ---------- | ----------------------------------------------------- |
| samples-data.ts | 29         | 2 (CI/CD Pipeline [TD], Git Branching Workflow [LR])  |
| #1467 repro     | 1          | 1: 4 fan-in pairs (all both-labeled), 2 fan-out pairs |

- CI/CD Pipeline (TD): one fan-in pair, both labeled (`No` edges into
  `Fix & Retry`); the two drops stay on separate columns right next to each
  other and read correctly.
- Git Branching Workflow (LR): one fan-out pair out of `develop`; no labels
  involved on the shared run.

Neither sample shows the #1467 symptom (a label that cannot be tied to its
edge). Only the repro does, because it stacks 4+ labeled edges into one node.
Conclusion: splitting lanes would change at most 2 of the 29 existing flowchart
samples, so blast radius in the
sample set is small; the unknown is the broader test corpus and real-world
graphs, which this pass did not cover.

## Options, restated with this evidence

- **(a) one lane/drop per source edge:** needs an edge-aware cost or port
  allocator in the router (see above). Small effect on the existing samples,
  but large code surface and a risk to every fan-in diagram's width/height.
- **(b) keep the shared path, attribute labels:** localised to label placement
  and draw code, avoids rerouting, but cannot make four stacked edges
  distinguishable by itself (the #1467 argument still holds).
- A cheap middle path to consider: only split when the shared run carries 2+
  labeled edges, which touches none of the current samples besides the repro.

## Reproducing

The measurement was a throwaway tsx script (not committed) following the method
above. Re-create it against `convertToAsciiGraph` + `createMapping` and the
`samples` export if the numbers need refreshing.
