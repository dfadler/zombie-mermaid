---
title: The Architecture Review That Paid for Itself the Same Day
date: 2026-09-11
description: An eight-item architecture review split four oversized React files and opened a CSS Modules seam with an explicit "no visual change" rule. Thirteen hours later, about twenty feature and fix PRs built a new diagram-discovery section on top of it, none of them touching the old monolith shape again.
---

[#931](https://github.com/dfadler/zombie-mermaid/issues/931) is not a bug
report. It's an architecture review, filed by the repo owner through a
dedicated review session rather than in response to any specific incident,
against the `demo/` React layer — the SSR-plus-island-hydration generator
behind the marketing home, the live editor, the diagrams hub, the fork-fixes
showcase, the maintenance dashboard, and the blog. Its six goals are stated
plainly: one component per file, ideally; every component tested; one shared
HTML shell instead of six divergent ones; a path to React Router; a path to
CSS Modules; a build process that already mostly exists. Its non-goals are
just as explicit: no behavior or visual change to any shipped page, and no
repo-wide router migration in one shot. Seven of its eight sub-issues closed
within about two hours on the night of 2026-09-10. Thirteen hours after that,
roughly twenty feature and fix PRs landed on the files that review had just
reorganized — and none of them needed to touch the old shape again.

## What was actually oversized

Four files carried the bulk of the review's weight, and the numbers explain
why they were in scope rather than any of the dozens of other components in
`demo/`:

- `index-app.tsx` — 2,201 lines holding roughly fifteen unrelated
  presentational components with no shared state: the hero visual, the hero
  install panel, the CLI/MCP feature panels, six gallery tile illustrations,
  the diagram gallery teaser, the blog teaser, and more.
- `nav.tsx` — 1,744 lines tangling four unrelated concerns: a
  package-manager-detection hook (~480 lines of popover and clipboard
  state), the install popover's markup, a raw vanilla-JS mobile-menu
  script, and roughly 150 lines of CSS-string generation.
- `icons.tsx` — 1,126 lines exporting 43 stroke-based icon components with
  no internal grouping at all.
- The editor cluster — `editor-page.tsx` (617 lines), `editor-app.tsx`
  (738 lines), and `editor-config.tsx` (1,092 lines), audited together as
  one 2,447-line unit before anything was split.

[#960](https://github.com/dfadler/zombie-mermaid/pull/960),
[#962](https://github.com/dfadler/zombie-mermaid/pull/962),
[#974](https://github.com/dfadler/zombie-mermaid/pull/974), and
[#961](https://github.com/dfadler/zombie-mermaid/pull/961) closed all four,
in that rough order, between 23:38 UTC on 2026-09-10 and 01:31 UTC the next
morning. Each is a straight extraction — the icons file split along its own
existing section-comment boundaries rather than one file per icon (43 files
felt like more indirection than 43 four-line components warranted), the nav
file split by concern into a hook, a popover module, a script constant, and
a CSS module, the editor cluster split after all three files were read start
to finish and written up before a single line moved. [#959](https://github.com/dfadler/zombie-mermaid/pull/959)
closed the CSS Modules sub-issue the same window, converting
`primitivesCss()` into a real `.module.css` file resolved at build time
through Vite — one proof-of-concept conversion, per its own issue's scope,
now that #931's shared-Document and `generatePage()` sub-issues (already
done before this window) gave every `*Css()` function one place to attach
instead of six. Seven of #931's eight boxes are checked. The eighth —
a narrow React Router prototype on the editor page — is still open,
deliberately scoped as a single-page experiment rather than a migration.

## Thirteen hours of quiet, then twenty PRs

Nothing shipped against `demo/` for about thirteen hours after #959 merged.
Then, starting at 15:33 UTC on 2026-09-11, a run of feature and fix PRs
began landing that built out most of a new diagram-discovery section for the
site, closing an umbrella issue of its own, [#989](https://github.com/dfadler/zombie-mermaid/issues/989),
whose design was drawn from a specific reference: [agents.craft.do/mermaid](https://agents.craft.do/mermaid),
a competing site that renders every sample on one continuously-scrolling
page, grouped by category.

The umbrella split into three pieces, each its own PR:

- [#1002](https://github.com/dfadler/zombie-mermaid/pull/1002) added
  specific-diagram detail pages — one per real sample, e.g.
  `diagrams/flowchart/ci-cd-pipeline.html` — reusing the existing
  "source → render" split panel verbatim, plus a new working SVG/ASCII
  output toggle.
- [#1008](https://github.com/dfadler/zombie-mermaid/pull/1008) added
  single-tag static search pages, following a design doc of its own
  ([`docs/decisions/diagram-tag-search.md`](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/diagram-tag-search.md)):
  22 tags across all six diagram types, each detected mechanically from a
  sample's real Mermaid source via regex or keyword rules — not
  hand-assigned — with a small dev tool, `scripts/print-tag-coverage.ts`,
  to print every rule's actual matches.
- [#1010](https://github.com/dfadler/zombie-mermaid/pull/1010) added a
  "View all" single-scroll page across all 86 samples, reusing the
  fixed-aspect-ratio thumbnail frame that had already fixed an earlier
  version of this exact page from running to roughly 18,000 pixels tall
  ([#708](https://github.com/dfadler/zombie-mermaid/pull/708)), and
  explicitly revisiting an older layout decision doc rather than ignoring
  it.

Around and after that umbrella: [#1004](https://github.com/dfadler/zombie-mermaid/pull/1004)
added a per-type example-count pill to the diagrams hub, [#1005](https://github.com/dfadler/zombie-mermaid/pull/1005)
rewrote near-duplicate sample descriptions the new detail pages had made
newly visible side by side, [#1014](https://github.com/dfadler/zombie-mermaid/pull/1014)
added an "About this notation" section to each diagram-type page, and
[#1018](https://github.com/dfadler/zombie-mermaid/pull/1018) linked each
tag page to its corresponding Mermaid syntax docs section.

A second, separate thread added real interaction to pages that had been
static: [#979](https://github.com/dfadler/zombie-mermaid/pull/979) gave the
homepage hero a segmented SVG/ASCII output toggle, backed by the library's
own `renderMermaidASCII()` rather than an approximation, and
[#983](https://github.com/dfadler/zombie-mermaid/pull/983) gave the theme
showcase the same toggle. [#980](https://github.com/dfadler/zombie-mermaid/pull/980)
added a real fullscreen mode to the live editor, driven by the browser's own
Fullscreen API and a `fullscreenchange` listener rather than a CSS overlay,
so the icon stays correct even when the browser exits fullscreen on its own.
[#1015](https://github.com/dfadler/zombie-mermaid/pull/1015) brought the same
fullscreen toggle to the diagram output panel. Underneath both threads sat a
long tail of the unglamorous fixes any UI push this size produces — a
mobile-width overflow on the install pill ([#981](https://github.com/dfadler/zombie-mermaid/pull/981)),
the editor card showing the page's dark background through it ([#982](https://github.com/dfadler/zombie-mermaid/pull/982)),
a render panel collapsing below 900px ([#1009](https://github.com/dfadler/zombie-mermaid/pull/1009)),
a scroll-fade missing from two different ASCII output wells ([#1006](https://github.com/dfadler/zombie-mermaid/pull/1006),
[#1017](https://github.com/dfadler/zombie-mermaid/pull/1017)).

## What the split actually bought

None of that is a story about a refactor *preventing* bugs — the polish-fix
list above is proof it didn't, and wasn't meant to. The actual claim is
narrower and checkable: when [#979](https://github.com/dfadler/zombie-mermaid/pull/979)
added the hero's output toggle, its diff touches a new,
purpose-built `hero-output-panel.tsx` and a much smaller `index-app.tsx`
that now composes it — not a further-swollen 2,201-line file. When [#1002](https://github.com/dfadler/zombie-mermaid/pull/1002)
added the detail pages, it added `diagram-detail-app.tsx` and
`diagram-pages-data.ts` as new, focused files, reusing the split-out
`diagram-page.tsx` shell rather than growing anything monolithic. Every PR
in the thirteen-hours-later batch is additive to the shape #931 left behind.
None of them is a "split this file, it's grown too big again" PR, and none
needed to be — the same outcome the review's own non-goal ("no behavior or
visual change") was written to protect, just measured from the other side:
not that the refactor didn't break anything, but that it didn't need
revisiting the moment real work started depending on it.

That's the same bet [this blog's post on refactor timing](/blog/refactor-after-the-audit-not-before.html)
made about a different codebase layer back in August, restated with fresh
evidence: an architecture review scoped to *only* reorganize, with an
explicit rule against changing behavior while doing it, is the kind of work
whose return shows up in what the next twenty PRs *don't* have to do. Here,
that return arrived the same day.
