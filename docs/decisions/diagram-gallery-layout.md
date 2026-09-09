# Diagram gallery layout: inline capped grid with expand, not a new page

## Context

[#712](https://github.com/dfadler/zombie-mermaid/issues/712)/[#713](https://github.com/dfadler/zombie-mermaid/issues/713)
(landed in [#725](https://github.com/dfadler/zombie-mermaid/pull/725)) fixed
_what_ content the diagram examples gallery shows: `samples-data.ts`'s
`Sample.gallery?: true` field, curating 51 samples (3–14 per type) around
evaluation value rather than exhaustive syntax coverage — see
[`docs/decisions/diagram-gallery-scope.md`](./diagram-gallery-scope.md).
[#714](https://github.com/dfadler/zombie-mermaid/issues/714) picked up
_layout_: how that curated set actually renders on `diagrams/<type>.html`,
following this repo's established process of building from a real
design-canvas artboard rather than hand-designing inline UI —
[#708](https://github.com/dfadler/zombie-mermaid/pull/708) was closed
specifically for skipping that process, producing ~18,000px-tall pages from
unconstrained `width:100%; height:auto` SVG scaling with no curation and no
navigation aid.

Three directions were drafted as real desktop + mobile artboards on the
design canvas: <https://claude.ai/code/artifact/d82d53c8-9678-4013-aa72-5859560b211f>.

## Directions considered

**A — Inline capped grid + expand (chosen).** A new "More examples" section
on the existing `diagrams/<type>.html` page, directly below "Source →
render": a `SectionEyebrow`/`h2` intro, then the curated set in a
`repeat(3, minmax(0,1fr))` grid (1 column on mobile), capped at 6 cards on
desktop / 4 on mobile with a "Show N more" pill revealing the rest.
Each card is a `Card` (`tone="panel"`) with a fixed `aspect-ratio: 4/3`
thumbnail frame — the diagram's rendered SVG is letterboxed inside it via
`preserveAspectRatio`/`object-fit`-style containment, so a tall/narrow
diagram (the artboard stress-tests this with "Subgraphs") pillarboxes
instead of blowing out the card, which is the direct fix for #708's bug.
No new route. Reuses `Card`/`Pill`/`SectionEyebrow` verbatim; the expand
toggle is demo-site chrome only (a plain class/attribute toggle), never
touching the rendered diagram itself, matching
[`docs/decisions/no-script-interactivity.md`](./no-script-interactivity.md).

**B — Dedicated per-type gallery page.** The type page teases 3 examples
plus a "See all N examples →" link to a new `/diagrams/<type>/examples.html`
route showing the full curated set uncapped. Cleaner as a dedicated SEO
surface for the full set, but needs a new `pages.ts` route and nav/breadcrumb
wiring per type, and splits the "evaluate this type" journey across two
pages instead of one.

**C — Cross-type combined gallery (sketch only).** A single
`/diagrams/gallery.html`, closer in spirit to the pre-redesign `index.html`:
one section per type, each a horizontally-scrolling row of cards (bounded
height regardless of item count, since a row's height never grows with
its length). Closest to what the #712 audit found people actually used
(browsing/searching across everything at once), but reintroduces the
single-page-for-everything shape the #712/#713 audit deliberately scoped
away from, and duplicates content already on each type page. Drafted only
as a lower-fidelity comparison sketch, not carried to full fidelity.

## Decision

**Direction A.** It satisfies #714's constraints most directly and with the
least new surface area:

- Bounded height by construction (a fixed card cap, not a page-height
  budget to police later) — the artboard's Flowchart example (the largest
  curated set, 14 items) renders at roughly 1000px for the whole new
  section, nowhere near #708's ~18,000px.
- No new route, no new nav/breadcrumb wiring, no split evaluation journey —
  a visitor stays on the page they're already evaluating a type from.
- The fixed-aspect-ratio thumbnail frame is a direct, provable fix for
  #708's card-sizing bug, independent of which direction wins.
- Real, distinct mobile treatment (cap drops to 4, grid drops to 1 column,
  the expand pill goes full-width) rather than "hide the sidebar."

Direction B remains a reasonable follow-up if the curated set grows past
what a capped inline section serves well, but isn't justified at today's
3–14-items-per-type scale. Direction C isn't recommended: it re-litigates
scope #712/#713 already closed.

## Consequences

- [#715](https://github.com/dfadler/zombie-mermaid/issues/715) implements
  Direction A: `demo/diagram-pages-data.ts`'s "more examples" helper filters
  `sample.gallery === true` (already wired conceptually by #725; #715 wires
  the render path), a new "More examples" section in
  `demo/components/diagram-page.tsx` per the artboard, and regenerated
  golden-DOM/visual-regression fixtures.
- The expand/collapse interaction is demo-site chrome, implemented the same
  way this codebase's other non-diagram interactivity is (the theme picker,
  the mobile nav menu) — never inside the library's own SVG output.
