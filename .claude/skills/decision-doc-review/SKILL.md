---
name: decision-doc-review
description: |
  Writing or editing a decision page (`docs/decisions/*.md`), or recording a decision in the repo:
  keep the page short, put the long reasoning on the issue, and self-review the draft before the
  PR. Use when you add or edit such a page, or are asked whether one is ready, to review it, or
  to sanity-check its algorithm or scope claims. Not for code review, PR bodies, or other docs.
---

# decision-doc-review

## Contract

- **Input:** a draft `docs/decisions/*.md`, as a file or pasted text.
- **Output:** one finding list per checklist item, or "nothing found" for an item you checked.
- **Does not:** review code, PR bodies or docs outside `docs/decisions/`.

Keep the page to the decision, its context and its consequences. Investigation, measurements and
the long reasoning go in a comment on the issue (see `research-findings`), linked from the page.

A decision doc proposing an algorithm, data model, or boundary between pieces of work reads just
as fluently when a claim in it is wrong as when it is right. Before opening the PR, walk the
draft through these five items and fix what each finds before any external reviewer (human or bot) sees it. This applies whether a human or an agent drafted it.

1. **Degenerate and edge-case inputs.** Trace the proposal by hand against empty input, a single
   element, a cycle or self-reference if the domain has a graph or tree shape, and the
   maximally asymmetric case (uneven padding or sizes on each side), not only the doc's own
   median example.
2. **Boundary and off-by-one arithmetic.** For any conversion between coordinate systems,
   indices or units (center-to-edge, 0- vs 1-indexed, inclusive vs exclusive), check both ends.
   Don't leave a fractional or rounding step unspecified: state which direction it rounds and why.
3. **Ambiguous terminology.** If a term could mean two quantities (a box's own center vs. its
   padded slot's center), pick one meaning, define it in the doc, and use it consistently; the
   two diverge exactly in the asymmetric case above.
4. **Claims about a sub-issue's scope.** If the doc says a linked, not-yet-implemented sub-issue
   needs (or doesn't need) some logic (for example "no collision-compaction needed"), verify
   that against the actual shape of the problem, not the sub-issue's title. Two independently
   placed elements from this doc's own design can still collide.
5. **Cited precedent.** If the doc cites an existing function, convention or prior decision as
   justification, open the reference and confirm it says what is claimed.

Report the result as a list of findings per item (or "nothing found" for an item you actually
checked), not a blanket "looks good". The rationale lives in
`docs/decisions/decision-doc-self-review-checklist-977.md`
([#1063](https://github.com/dfadler/zombie-mermaid/issues/1063)).
