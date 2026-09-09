# Diagram gallery scope: curated real-world examples, not exhaustive coverage

## Context

The pre-#590 redesign served all of `samples-data.ts` (~90 samples, grouped
by category with a sidebar and live search) as one interactive gallery —
`index.html`. The #590 redesign split that into a marketing home page plus
per-diagram-type pages (`diagrams/<type>.html`), each showing exactly one
hero example. The depth of examples the old gallery offered was lost in
that split, and the "See all samples" link left on each type page points at
an anchor (`../#samples-heading`) that no longer exists.

This wasn't a deliberate cut. [#598](https://github.com/dfadler/zombie-mermaid/issues/598)
(home-page redesign) explicitly planned a "Diagram gallery teaser — links
to the Diagrams section," assuming a real gallery would still exist there.
[#600](https://github.com/dfadler/zombie-mermaid/issues/600) (diagrams hub)
and [#601](https://github.com/dfadler/zombie-mermaid/issues/601) (the
flowchart detail template every other type page copied) each scoped
themselves to a directory/SEO-landing-page shape instead — "a 'View
examples' link," "source + rendered SVG side by side," both explicitly
singular. Nobody closed the gap between what #598 assumed and what #600/601
actually built. `pages.ts`'s own header comment confirms the per-type pages
were built for a different primary purpose than the old gallery — SEO
crawlability (one indexable URL per type), not interactive browsing.

[#708](https://github.com/dfadler/zombie-mermaid/pull/708) was a first
attempt at restoring the depth: render every remaining sample per category
into a card grid. It worked, but surfaced real problems — page height
reaching ~18,000px on the flowchart page (SVGs scaled `width:100%;
height:auto` regardless of a sample's intrinsic aspect ratio), no
curation (every non-featured sample shown, undifferentiated from
visual-test-only fixtures), and no navigation aid across a still-large flat
list. It was closed rather than merged; the investigation is tracked at
[#711](https://github.com/dfadler/zombie-mermaid/issues/711) with sub-issues
[#712](https://github.com/dfadler/zombie-mermaid/issues/712) (audit) and
[#713](https://github.com/dfadler/zombie-mermaid/issues/713) (content
strategy), whose findings this document records.

### What made the old gallery work, and what didn't

Recovered from `git show 1161488:index.ts` /
`demo/components/index-page.tsx` (the last commit before the #598 redesign).
It offered category grouping via a collapsible sidebar, live client-side
search, dual SVG/ASCII output per sample, and a per-sample "Edit" link into
the live editor. The search feature existed specifically because
[#284](https://github.com/dfadler/zombie-mermaid/issues/284) (**Severity:
High**) found that "88 samples across 7 sidebar categories... has outgrown
pure browsing" — direct evidence that an unfiltered flat/grouped list stops
being navigable well before 90 items. The gallery also carried real,
independently-discovered debt: a closed design-review cluster
([#278](https://github.com/dfadler/zombie-mermaid/issues/278)–[#286](https://github.com/dfadler/zombie-mermaid/issues/286))
found WCAG AA contrast failures, undersized mobile touch targets, and
permanent debug-looking progress text, all fixed before the #590 redesign
began. Net: a justified, deliberately-built search feature sitting on real
polish gaps — not simply "the old thing was better."

## Decision

Scope `diagrams/<type>.html`'s example content around **evaluation value**
("does this handle my use case?") rather than **exhaustive syntax
coverage** ("does it document every construct?"). `samples-data.ts` already
serves the visual-test suite regardless of gallery membership — every
sample stays there for that purpose — so gallery inclusion is a separate,
additive concern, not a re-scoping of what the test suite covers.

Concretely: `Sample` gained an optional `gallery?: true` field
(`samples-data.ts`). Only samples explicitly marked opt into a type's
gallery; a new visual-test fixture defaults to excluded, so the gallery
doesn't silently grow as coverage is added. #713's curation pass marked 51
of the 86 non-hero, non-Interactivity samples across the six diagram types:

| Type      | Total | Gallery | Cut                    |
| --------- | ----- | ------- | ---------------------- |
| Flowchart | 24    | 14      | 9 (1 already featured) |
| State     | 4     | 3       | 0 (1 already featured) |
| Sequence  | 18    | 13      | 4 (1 already featured) |
| Class     | 16    | 7       | 8 (1 already featured) |
| ER        | 14    | 7       | 6 (1 already featured) |
| XY Chart  | 10    | 7       | 2 (1 already featured) |

Full per-sample reasoning is in
[#713's comment](https://github.com/dfadler/zombie-mermaid/issues/713#issuecomment-5594659954).
In short, cuts fall into two buckets:

- **Redundant with a broader reference sample already kept** — e.g.
  Flowchart's "All 12 Flowchart Shapes" supersedes three narrower shape
  batches; Class's "All 6 Relationship Types" supersedes six near-identical
  two-box diagrams; ER's "All Cardinality Types" and "Mixed Identifying &
  Non-Identifying" each supersede several individual variants.
- **Explicit regression/edge-case fixtures**, identifiable from their own
  description text (e.g. Sequence's "Self-Messages with Notes" — _"tests
  that notes clear self-message loops and stack..."_ — and "Alt/Else Long
  Label With Uninvolved Participant" — _"Regression coverage for
  #352/#387..."_) — real test coverage, not gallery material.

Every category kept its real-world-shaped examples (a CI/CD pipeline, an
OAuth flow, an e-commerce schema, a sprint burndown chart, ...) — these
carry the highest evaluation value per the framing above and were never
candidates for cutting.

## Consequences

- `demo/diagram-pages-data.ts`'s per-type "more examples" helper (whatever
  design #714/#715 land on) filters on `sample.gallery === true` in
  addition to `category`, not on "every sample in this category" the way
  #708 did — the curation is structural, not something a future PR has to
  rediscover from an issue thread.
- Adding a new sample to `samples-data.ts` for test coverage does **not**
  make it appear in a user-facing gallery by default — a deliberate choice
  is required (`gallery: true`), reversing #708's implicit "everything
  shows up" behavior.
- The "does it document every construct" need (closer to what the old
  gallery's exhaustive list served) stays out of scope for
  `diagrams/<type>.html` — if that's still wanted, it belongs in
  `docs/guides/` as reference documentation, a separate concern from this
  decision.
- This document doesn't decide _layout_ (grid vs. dedicated page vs.
  curated-highlights-plus-link-out) — that's
  [#714](https://github.com/dfadler/zombie-mermaid/issues/714)'s job, now
  working from a fixed, sized-down content set (3–14 items per type)
  instead of an unbounded one.
