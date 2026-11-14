# Self-review checklist for decision docs

Status: accepted

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

Before opening a PR that adds or edits a `docs/decisions/*.md` file, walk the draft
through the five-item self-review checklist: edge-case inputs, boundary arithmetic,
ambiguous terminology, claims about a sub-issue's scope, and cited precedent. The checklist
text lives in the `decision-doc-review` skill
([`.claude/skills/decision-doc-review/SKILL.md`](../../.claude/skills/decision-doc-review/SKILL.md)),
which is the single copy; fix what each item finds instead of leaving it to an external
reviewer (human or bot) after the PR is open.

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
