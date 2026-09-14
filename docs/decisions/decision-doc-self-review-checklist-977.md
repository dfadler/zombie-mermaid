# Self-review checklist for decision docs

## Context

PR #975's review discussion surfaced a process gap: an AI-authored design
doc under `docs/decisions/` doesn't get an equivalent of a "diff the
output" check the way a refactor does. CodeRabbit caught four real,
substantive gaps in that PR's decision doc — cycle handling, an off-by-one
rounding step, ambiguous "parent center" terminology, and a wrong
sub-issue scope claim (see
[#977](https://github.com/dfadler/zombie-mermaid/issues/977)) — that a
deliberate edge-case walkthrough would have caught before the PR ever
opened. A decision doc proposing an algorithm, data model, or boundary
between pieces of work reads just as fluently when a claim in it is wrong
as when it's right, so this class of gap doesn't surface on a casual
re-read the way a broken build or a failing test would.

## Decision

Before opening a PR that adds or edits a `docs/decisions/*.md` file, walk
through this checklist against the draft (applies whether the doc was
drafted by a human or an agent — an agent-authored draft just makes it
easier to skip):

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
reviewer (human or bot) to catch it after the PR is open.

## Consequences

- Adds a manual walkthrough step before opening a decision-doc PR; it
  doesn't replace external review (CodeRabbit, a human reviewer) — it aims
  to catch the same class of gap earlier, before the PR exists.
- Applies only to `docs/decisions/*.md` files, not to other documentation
  or to code changes.
- Writing this checklist down doesn't make it get followed — see
  [#1063](https://github.com/dfadler/zombie-mermaid/issues/1063), tracking
  how to encode it as something Claude actually consults at the point of
  authoring a decision doc, not just documentation a human might read.
