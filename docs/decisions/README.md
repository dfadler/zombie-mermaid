# Decisions

Short, rare records of settled decisions. Not an ADR process — no numbering, no template tooling, just a page per decision when one is warranted.

## When to add one

Only when both are true:

- It closes off an alternative someone (human or agent) would plausibly re-propose later.
- The reasoning isn't already obvious from the code or an existing doc.

Most changes don't need one. Don't backfill past decisions or write one speculatively — add it the first time a qualifying decision actually comes up.

## Format

One page, one decision:

```
# Title

## Context

What prompted the decision — the problem or question.

## Decision

What was decided.

## Consequences

What this rules out, what it trades off, what follows from it.
```

## Self-review before opening the PR

A decision doc proposing an algorithm, data model, or boundary between pieces
of work doesn't get a mechanical "diff the output" check the way a refactor
does — a wrong claim reads just as fluently as a right one. Before opening
the PR, walk through this checklist against your own draft (this applies
whether the doc was drafted by a human or an agent — an agent-authored draft
just makes it easier to skip):

- **Degenerate and edge-case inputs.** Trace the proposed algorithm/data
  model by hand against: empty input, a single element, a cycle or
  self-reference if the domain has a graph/tree shape, and the
  maximally-asymmetric case (e.g. uneven padding/sizes on each side) rather
  than only the median example used in the doc's own walkthrough.
- **Boundary and off-by-one arithmetic.** For any conversion between two
  coordinate systems, indices, or units (center-to-edge, 0- vs 1-indexed,
  inclusive vs exclusive ranges), check what happens at both ends, and don't
  leave a fractional or rounding step unspecified — state which direction it
  rounds and why.
- **Ambiguous terminology.** If a term could plausibly mean two different
  quantities (e.g. a box's own center vs. its padded slot's center), pick one
  meaning explicitly and define it in the doc rather than trusting that
  context disambiguates it — those two quantities diverge under exactly the
  asymmetric case above.
- **Claims about a sub-issue's scope.** If the doc asserts that a linked,
  not-yet-implemented sub-issue needs (or doesn't need) some class of logic
  (e.g. "no collision-compaction needed here"), verify that claim against the
  actual shape of the problem, not just against the sub-issue's title or
  summary — two independently-placed elements from _this_ doc's own design
  can still collide with each other even if neither one individually needs
  the logic in isolation.
- **Cited precedent.** If the doc cites an existing function, convention, or
  prior decision as justification, open that reference and confirm it
  actually says what's claimed, rather than restating a remembered
  paraphrase.

Run through each item and fix what it finds — don't rely on an external
reviewer (human or bot) to catch it after the PR is open. See
[#977](https://github.com/dfadler/zombie-mermaid/issues/977) for the review
pass that prompted this checklist.
