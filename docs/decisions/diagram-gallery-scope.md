# Diagram gallery scope: curated real-world examples, not exhaustive coverage

## Context

The #590 redesign split the pre-existing single-page sample gallery
(`index.html`, ~90 examples grouped by category with a sidebar and search)
into per-diagram-type pages (`diagrams/<type>.html`) showing one hero
example each — not a deliberate cut, but a scoping gap between what
[#598](https://github.com/dfadler/zombie-mermaid/issues/598) planned and
what [#600](https://github.com/dfadler/zombie-mermaid/issues/600)/[#601](https://github.com/dfadler/zombie-mermaid/issues/601)
actually built. [#708](https://github.com/dfadler/zombie-mermaid/pull/708)
attempted a direct restore (render every remaining sample per category)
and was closed after surfacing real problems: ~18,000px-tall pages from
unconstrained SVG scaling, no curation, no navigation aid.

Full investigation notes — what made the old gallery work (and what
didn't), and the historical trail showing this wasn't intentional — are in
[#712](https://github.com/dfadler/zombie-mermaid/issues/712)'s comment.
Full per-sample curation reasoning is in
[#713](https://github.com/dfadler/zombie-mermaid/issues/713)'s comment.
This document records only the resulting decision.

## Decision

Scope `diagrams/<type>.html`'s example content around **evaluation value**
("does this handle my use case?") rather than **exhaustive syntax
coverage** ("does it document every construct?") — see #712 for why.
`samples-data.ts` gained `Sample.gallery?: true`; only samples explicitly
marked opt into a type's gallery, so a new visual-test fixture defaults to
excluded rather than silently growing the gallery. #713 marked 51 of 86
non-hero, non-Interactivity samples:

| Type      | Total | Gallery | Cut                    |
| --------- | ----- | ------- | ---------------------- |
| Flowchart | 24    | 14      | 9 (1 already featured) |
| State     | 4     | 3       | 0 (1 already featured) |
| Sequence  | 18    | 13      | 4 (1 already featured) |
| Class     | 16    | 7       | 8 (1 already featured) |
| ER        | 14    | 7       | 6 (1 already featured) |
| XY Chart  | 10    | 7       | 2 (1 already featured) |

Cuts are either redundant with a broader reference sample already kept
(e.g. "All 12 Flowchart Shapes" supersedes three narrower shape batches),
or explicit regression/edge-case fixtures (identifiable from their own
description text) that belong in the visual-test suite but never in a
gallery. Every category's real-world-shaped examples (a CI/CD pipeline, an
OAuth flow, an e-commerce schema, ...) were kept — see #713 for the full
per-sample table.

## Consequences

- `demo/diagram-pages-data.ts`'s per-type "more examples" helper filters
  on `sample.gallery === true`, not "every sample in this category"
  (#708's approach).
- A new `samples-data.ts` sample doesn't appear in a user-facing gallery
  by default — `gallery: true` is opt-in.
- Exhaustive-syntax-reference coverage (closer to what the old gallery's
  full list served) stays out of scope for `diagrams/<type>.html`; if
  still wanted, it's a separate `docs/guides/` concern, not decided here.
- Layout (grid vs. dedicated page vs. curated-highlights-plus-link-out) is
  [#714](https://github.com/dfadler/zombie-mermaid/issues/714)'s job, now
  working from a fixed, sized-down content set (3–14 items per type).
