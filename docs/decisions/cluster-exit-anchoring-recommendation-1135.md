# Recommendation: cluster-boundary edge-exit anchoring (#1135) — which plan to pursue

## Context

[#1135](https://github.com/dfadler/zombie-mermaid/issues/1135) and
[docs/decisions/cluster-exit-anchoring-scoping-1135.md](cluster-exit-anchoring-scoping-1135.md)
(PR [#1144](https://github.com/dfadler/zombie-mermaid/pull/1144)) scoped the
cluster-boundary edge-exit anchoring bug and spawned three candidate
implementation plans:
[#1148](https://github.com/dfadler/zombie-mermaid/issues/1148) (Option 1,
full compound-node modeling),
[#1149](https://github.com/dfadler/zombie-mermaid/issues/1149) (Option 2,
targeted `EdgeBundle` reuse), and
[#1150](https://github.com/dfadler/zombie-mermaid/issues/1150) (Option 3,
post-process path-splicing). Each needed an independent viability/
desirability review before implementation started on any of them.

## Decision

**Pursue Option 1 (#1148), but not exactly as scoped.** It's the only option
that produces genuinely correct output (independent per-edge boundary exit
points, matching real mermaid's compound-node clipping), and its "Large"
effort estimate is realistic — if anything, slightly low. Two amendments are
needed before implementation starts:

1. **Label placement is not free from reusing `pathfinder.ts`'s
   `routeEdge`.** `routeEdge` returns a bare path; the label-line logic
   (`applyLabelLine`, `route.labelSegment`) lives in `edge-routing.ts`,
   coupled to lane assignment and direction-pair selection the plan doesn't
   currently plan to touch. #1135's actual repro (`done`/`fail` labels on a
   composite state's transitions) is exactly the labeled case, so this is
   load-bearing, not optional.
2. **The new grid-space subgraph bounding box must account for
   `ensureSubgraphSpacing`'s post-hoc adjustment of the existing
   drawing-space box**, not just be "derived from the same shared traversal
   helper" — that mitigation as worded doesn't obviously cover a timing
   mismatch (one box adjusted after the fact, one not).

**Drop Option 3 (#1150).** Its own planning pass already concluded the
"cheap, no pathfinding changes" premise doesn't survive contact with the
actual codebase, and its revised effort estimate already erases its cost
advantage over Option 1 while carrying a genuinely worse failure mode
(silent visual corruption vs. a caught, visibly-wrong-until-fixed defect).

**Option 2 (#1149) is not a safe fallback for this specific bug.** Its
central premise — that `draw-bundles.ts` already solves "multiple lines
converging on one cell" — is only true for line/corner glyphs; there is no
code path anywhere in bundle drawing that calls the label-placement logic
ordinary edges use. Since #1135's actual repro is exactly the labeled case,
this isn't a risk to verify, it's a missing feature that would need building
from scratch — at which point Option 2 stops being meaningfully cheaper than
Option 1 while still producing a visual (a single shared exit point) its own
plan admits doesn't match real mermaid's behavior.

Full ground-truth investigation, source citations, and the self-review
checklist walkthrough behind this recommendation are in
[#1161](https://github.com/dfadler/zombie-mermaid/issues/1161).

## Consequences

- Recommend closing #1150 (Option 3) as investigated-and-rejected, its own
  planning conclusion confirmed independently.
- Recommend #1149 (Option 2) stay open but be re-labeled as "not viable for
  #1135's labeled-edge case as scoped" rather than a live third option —
  the underlying `EdgeBundle`-reuse idea may still be worth keeping on file
  for a future unlabeled-only cluster-exit request.
- Recommend #1148 (Option 1) proceed to implementation only after its plan
  is revised to add explicit label-placement design and the grid-space/
  drawing-space bounding-box consistency question addressed above — as
  currently written, starting implementation would hit both gaps mid-PR
  rather than before it opens.
- This doc does not implement anything — no code under
  `packages/ascii-renderer/src/**` was changed to produce it, matching the
  scoping doc's own convention.
