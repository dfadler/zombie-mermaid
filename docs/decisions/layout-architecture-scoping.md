# Scoping: pluggable/domain-aware layout architecture

Status: **scoping note, not a decision.** Written for
[#538](https://github.com/dfadler/zombie-mermaid/issues/538), split from
[#536](https://github.com/dfadler/zombie-mermaid/issues/536). No code under
`src/layout-engine/**` or any renderer was changed to produce this — findings
below are grounded in reading the current implementation, not a prototype.

## TL;DR

- **Engine-swapping is not retrofittable today without touching three
  independent call sites.** ELK is not isolated behind one seam — it's
  threaded through *three* separate, hand-rolled graph-construction paths
  (`layout-engine/to-elk.ts` for flowchart/state, `class/layout.ts`, and
  `er/layout.ts`), each of which builds ELK's typed JSON format (`ElkNode`,
  `ElkExtendedEdge`, `elk.*` layout-option strings) directly against the
  diagram's own domain model. There is no engine-neutral intermediate graph
  representation to swap ELK out from under — the ELK format itself *is* the
  intermediate representation, in triplicate.
- **The ASCII renderers don't touch ELK at all.** Every ASCII diagram type
  (flowchart, class, ER, sequence) has its own from-scratch, character-grid
  layout algorithm, entirely independent of both ELK and each other's SVG
  counterpart. Swapping the SVG engine changes zero ASCII code; conversely,
  "pluggable layout" as a project-wide goal would need to solve the SVG
  problem and the ASCII problem separately — they don't share a seam either.
- **Sequence diagrams already do domain-aware, order-preserving layout** —
  and always have, incidentally rather than by explicit design. This is a
  low-risk, already-shipped example of exactly the pattern the CFG-aware
  layout research (VEIL, arXiv:2511.05066) argues for generically: no graph
  algorithm runs at all, messages are stacked strictly in source order.
  Flowcharts get a partial, weaker version of the same idea via ELK's
  `considerModelOrder` tie-break, which only influences crossing minimization
  within the general Sugiyama layout — it doesn't guarantee order the way
  sequence diagrams' layout does structurally.
- No specific near-term "extend order-preservation to another diagram type"
  work is called out as low-risk here — see
  [Domain-aware layout](#domain-aware-layout-assessment) below for why.

## Current architecture, as read

### SVG side: three independent ELK integrations, not one seam

`src/layout-engine.ts` is the only diagram family with a real pipeline
separation:

```
MermaidGraph --[to-elk.ts: mermaidToElk()]--> ElkNode (ELK JSON)
            --[elk-instance.ts: elkLayoutSync()]--> ElkNode (positioned)
            --[from-elk.ts: elkToPositioned()]--> PositionedGraph
```

This looks like a clean seam — `mermaidToElk` / `elkToPositioned` bookend a
pure `elkLayoutSync(graph)` call — but the seam is at the wrong altitude for
swapping the *engine*: `mermaidToElk` returns an `ElkNode`, not a neutral
graph. Its 700+ lines are almost entirely ELK-specific: `elk.algorithm`,
`elk.direction`, `elk.hierarchyHandling` (`SEPARATE` vs `INCLUDE_CHILDREN`),
hand-built hierarchical ports and hop/bridge edges to route cross-subgraph
edges under `SEPARATE` (`src/layout-engine/to-elk.ts:320-405`), and per-edge
`elk.edgeLabels.inline`/`placement` options. None of this could be handed to
a different engine (Dagre, or a native `dot` binary) without a full rewrite
of the conversion — the subgraph/port/hop-edge decomposition exists
specifically to work around ELK's own hierarchy-handling semantics
(`to-elk.ts:320-329`'s comment explains this is required because "ELK only
resolves an edge automatically when both endpoints are visible from the
edge's container").

Worse, `class/layout.ts` and `er/layout.ts` **do not go through
`layout-engine.ts` at all.** Each imports `elkLayoutSync` from
`elk-instance.ts` directly and builds its own inline `ElkNode` graph:

- `src/class/layout.ts:191-195` constructs its own root `ElkNode` with
  `'elk.algorithm': 'layered'`, `'elk.direction': 'DOWN'` hardcoded (no
  direction-override or subgraph support at all — class diagrams have no
  subgraphs).
- `src/er/layout.ts` does the same, with its own `directionToElk()` — a
  near-duplicate of `to-elk.ts`'s function of the same name, but with a
  different default (`RIGHT` vs flowchart's `DOWN`) baked in independently.

The only code shared across all three ELK call sites is
`src/layout-engine/elk-adapter-utils.ts`, whose own header comment states the
problem plainly: *"`from-elk.ts` (flowchart/state), `src/class/layout.ts`,
and `src/er/layout.ts` each independently walk an ELK edge's
`section.startPoint → bendPoints → endPoint` into a `Point[]`... This module
is the single place that logic lives, so the three call sites can't drift."*
That module only covers point/label extraction from ELK's *output* — none of
the graph-*construction* logic is shared. Three separate teams of code build
three separate `ElkNode` graphs, using ELK-specific vocabulary throughout.

**What a real engine-swap seam would need**: an engine-neutral intermediate
graph type (nodes with size/shape metadata, edges with optional labels,
compound/subgraph nesting, a requested direction) that all three diagram
types build once, plus a per-engine adapter (`toElk(graph)`, `toDagre(graph)`,
etc.) that translates *that* into the target engine's format, mirroring what
D2 does (see [D2 comparison](#d2s-layout-abstraction) below: D2 keeps one
graph model and per-engine "shims" for the handful of features an engine
can't express, e.g. container width/height only working on ELK/TALA). That's
a from-scratch design task, not a refactor of the existing conversion code —
`to-elk.ts` and its siblings would need to be rewritten against the new
neutral type rather than adapted, since so much of their logic (hop-edge
decomposition, hierarchical ports) exists purely to satisfy ELK's own
`hierarchyHandling` quirks and has no equivalent in a neutral model.

### SVG side: two diagram types that don't use graph layout at all

- `src/sequence/layout.ts` never touches ELK. Its header comment says so
  explicitly: *"Custom timeline-based layout (no ELK — sequence diagrams
  aren't graphs)."* Actors get fixed X positions by declaration order;
  messages are stacked at `messageY` strictly in **source/chronological
  order** (`layoutSequenceDiagram`, `src/sequence/layout.ts:351-478` — the
  main loop advances `messageY` monotonically per message, block, and note,
  with no reordering or crossing-minimization pass at all).
- `src/xychart/layout.ts` is direct coordinate-space math for axes/bars/
  lines — not a node/edge graph, so "layout engine" doesn't apply.

### ASCII side: four more independent layout algorithms, none of them ELK

None of the ASCII renderers reuse the SVG-side `PositionedGraph`/ELK
pipeline or the SVG-side per-diagram-type layout modules:

- `src/ascii/converter.ts` + `src/ascii/grid.ts`: a from-scratch
  character-grid layout for flowcharts/state diagrams (rank/column
  assignment, subgraph bounding boxes, its own `getEffectiveDirection`,
  its own edge routing in `edge-routing.ts`/`pathfinder.ts`). No ELK
  import anywhere in `src/ascii/`.
- `src/ascii/class-diagram.ts`: its own row-packing layout
  (`currentX`/`currentY` slot placement, `src/ascii/class-diagram.ts:462-500`)
  — completely independent of `src/class/layout.ts`'s ELK-based SVG layout.
  Parses the diagram fresh from `class/parser.ts` rather than reusing any
  positioned output.
- `src/ascii/er-diagram.ts`: its own layout (`findConnectedComponents`,
  `chooseFreeRow`) — independent of `src/er/layout.ts`.
- `src/ascii/sequence.ts`: its own position computation
  (`renderSequenceAscii`) — independent of `src/sequence/layout.ts`, though
  it's a much smaller reimplementation since sequence layout is already
  simple (chronological stacking) on both sides.

Net effect: **there are roughly nine distinct layout implementations** in
this codebase (SVG flowchart/state, SVG class, SVG ER, SVG sequence, SVG
xychart, ASCII flowchart/state, ASCII class, ASCII ER, ASCII sequence), and
only the SVG flowchart/state one uses a general-purpose layout algorithm at
all (ELK). Any "pluggable layout engine" framing that starts from "swap ELK
for X" only ever addresses 3 of those 9 — and even within those 3, ELK isn't
behind one seam.

## D2's layout abstraction

Per [d2lang.com/tour/layouts](https://d2lang.com/tour/layouts/), D2 keeps a
single internal graph model and lets the user pick the rendering engine at
the CLI/config level (`--layout=dagre|elk|tala`, or `$D2_LAYOUT`). The three
engines aren't drop-in equivalent, though — D2's own docs list per-engine
capability gaps (container-to-child connections fail under Dagre;
width/height constraints on containers only work under ELK/TALA;
position-locking is TALA-only), which D2 handles as documented
engine-specific limitations rather than papering over them. That's the
realistic bar for "pluggable": not perfect parity across engines, but one
shared graph model with engine-specific adapters and known, documented
capability gaps per engine — not, as zombie-mermaid has today, the target
engine's own types doing double duty as the internal model in three
independently-written places.

ELK's own "Graphviz Dot" algorithm option
([reference](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-graphviz-dot.html))
reinforces the same point from the other direction: ELK itself is built as a
pluggable-algorithm framework (15+ algorithms, including one that wraps
Graphviz's layered approach), all consumed through one shared `elk.*`
layout-option vocabulary and one `ElkNode` I/O format. zombie-mermaid
currently gets zero benefit from that pluggability — the codebase always
requests `'elk.algorithm': 'layered'` and never varies it — but it's a
reminder that "swap the algorithm" and "swap the engine" are different asks:
ELK already supports the former cheaply (change one string, in three
places), while the latter is the expensive one this note is about.

## Domain-aware layout assessment

Sequence diagrams are, today, already the thing the issue speculates might
be "feasible as an incremental addition": their layout preserves message
order top-to-bottom by construction, because the layout was never written as
a general graph algorithm in the first place (`sequence/layout.ts`'s own
header: "Custom timeline-based layout (no ELK — sequence diagrams aren't
graphs)"). This wasn't a deliberate response to order-preservation research —
it's the natural shape of a sequence diagram's semantics (messages *are* a
timeline) — but it validates the same idea the VEIL paper
(arXiv:2511.05066) argues for CFGs: skip generic layered/Sugiyama layout
entirely when the diagram already carries an intrinsic order, and position
directly from that order instead of asking a crossing-minimizing algorithm
to (hopefully) preserve it as a side effect.

Flowcharts get a much weaker version of the same idea:
`to-elk.ts:294`'s `'elk.layered.considerModelOrder.strategy':
'NODES_AND_EDGES'` asks ELK to use declaration order as a *tie-break* during
crossing minimization (confirmed load-bearing by the sibling-subgraph
reversal logic just above it, `to-elk.ts:425-448`, needed specifically
because "ELK's `considerModelOrder` uses [model order] as a tie-break during
crossing minimization and thus what ultimately decides left-right sibling
order" — see issue #444). That's meaningfully different from sequence
diagrams' guarantee: it's a heuristic nudge inside a general algorithm, not a
structural property of the layout. A flowchart with a strong top-to-bottom
"execution order" reading (state diagrams are the most CFG-like diagram type
this repo renders) could in principle get closer to VEIL's approach, but
that would mean **replacing** ELK's layered algorithm for that diagram type
with a bespoke order-preserving placement pass — the same category of
from-scratch work as building a new engine adapter, not a tweak to existing
ELK options. It is not a "comparatively low-risk near-term win": it would be
a new, unproven layout algorithm competing with a mature one (ELK layered),
for a diagram type (state/flowchart) that currently has zero user-reported
complaints about node ordering in this repo's issue history searched during
this scoping pass.

**No specific near-term win is being called out.** The honest read is that
sequence diagrams already capture the easy, high-value case for free, and
extending true order-preservation to flowchart/state diagrams is
architecturally the same size of effort as the engine-swap problem above
(a new layout algorithm needs to be designed and validated against the
existing ELK-based rendering across the diagram-heavy test/visual-regression
suite), not a smaller, separable one.

## What a from-scratch path would look like (if pursued later)

1. Design one engine-neutral graph IR (nodes with size + shape metadata,
   edges with optional labels, compound/nesting, requested direction) —
   informed by, but not copied from, `MermaidGraph` (which is closer to the
   parser's AST than a layout-ready graph) and ELK's own `ElkNode` shape
   (which is the right *shape* but the wrong *vocabulary* to keep neutral).
2. Rewrite `to-elk.ts`, `class/layout.ts`'s graph-building half, and
   `er/layout.ts`'s graph-building half to each build the neutral IR once,
   sharing that construction code instead of duplicating it (this alone —
   independent of any engine swap — would close the three-way duplication
   flagged above).
3. Add an `elk` adapter (`neutralToElk`, mostly today's `to-elk.ts` logic
   moved one layer down) and, only once a second engine is actually wanted,
   a second adapter for it, following D2's precedent of documenting
   per-engine capability gaps rather than requiring full parity.
4. Leave ASCII layout untouched — it is not graph-algorithm-driven in any
   diagram type today, so it sits outside this seam entirely regardless of
   what happens on the SVG side.

This is scoping only — no estimate is given here for calendar cost, since
the point of this note is the shape of the problem, not a commitment to do
it.
