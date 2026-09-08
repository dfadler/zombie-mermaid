# Scoping: pluggable/domain-aware layout architecture

Status: **scoping note, not a decision.** Written for
[#538](https://github.com/dfadler/zombie-mermaid/issues/538), split from
[#536](https://github.com/dfadler/zombie-mermaid/issues/536). No code under
`src/layout-engine/**` or any renderer was changed to produce this — findings
below are grounded in reading the current implementation, not a prototype.

## TL;DR

- **Engine-swapping is not retrofittable today without touching three
  independent call sites.** ELK is not isolated behind one seam — it's
  threaded through _three_ separate, hand-rolled graph-construction paths
  (`layout-engine/to-elk.ts` for flowchart/state, `class/layout.ts`, and
  `er/layout.ts`), each of which builds ELK's typed JSON format (`ElkNode`,
  `ElkExtendedEdge`, `elk.*` layout-option strings) directly against the
  diagram's own domain model. There is no engine-neutral intermediate graph
  representation to swap ELK out from under — the ELK format itself _is_ the
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
  work is called out as low-risk here — see the full analysis (linked below)
  for why.

## Full analysis

The detailed write-up — current architecture as read (the three independent
ELK integrations, the two graph-layout-free diagram types, the four
independent ASCII layout algorithms), the D2 comparison, the domain-aware
layout assessment, and what a from-scratch path would look like — is posted
on [#538](https://github.com/dfadler/zombie-mermaid/issues/538#issuecomment-5571620230)
rather than duplicated here, to keep this decision record short. The one
concrete, independently-actionable follow-up it identifies (deduping the
three ELK graph-construction paths) was tracked as
[#616](https://github.com/dfadler/zombie-mermaid/issues/616) and has since
landed: the three paths now share
`src/layout-engine/elk-graph-builder.ts` for the primitives they had each
hand-rolled — one `directionToElk()`, one `elk.padding` formatter, one
leaf-node shape, and one measured edge-label box — with the per-diagram-type
no-`direction` fallbacks (`DOWN` for flowchart/state/class, `RIGHT` for ER)
documented there as `ELK_DIRECTION_FALLBACK`.

That does **not** change the TL;DR above. The dedup was deliberately scoped
to shared primitives, not to an engine-neutral intermediate graph: each
renderer still builds ELK's own typed JSON directly against its domain
model, so engine-swapping remains the larger, separately-scoped work.

This is scoping only — no estimate is given here for calendar cost, since
the point of this note is the shape of the problem, not a commitment to do
it.
