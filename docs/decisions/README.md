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

Before opening a PR that adds or edits a decision doc, walk through the
checklist in
[Self-review checklist for decision docs](decision-doc-self-review-checklist-977.md)
against your own draft.
