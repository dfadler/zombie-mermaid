# Accessibility conformance statement

Last reviewed: 2026-09-09, against `zombie-mermaid` on `main`.

This is a scoped, honest statement of what `zombie-mermaid` guarantees today
— not a claim of full [WCAG 2.1](https://www.w3.org/TR/WCAG21/) conformance
at any level. Every guarantee below is either enforced by an automated CI
check (so a regression fails the build) or backed by a manual test-once
observation the "Verified how" column names — never asserted on assumption.
If you find a gap between this document and actual behavior, please
[open an issue](https://github.com/dfadler/zombie-mermaid/issues/new).

## Scope

`zombie-mermaid` has two output surfaces:

- **The library** (`renderMermaidSVG`, `renderMermaidASCII`, and friends) —
  the SVG/ASCII markup this package generates. This is what a downstream
  application embeds; its accessibility properties are what this package can
  actually promise, because they don't depend on how a consumer wires things
  up.
- **The demo/editor site** (`demo/`, `editor/`, `index.ts`) — the sample
  gallery and diagram editor this repo ships and deploys itself. Its
  accessibility properties are specific to that one page, not something
  every consumer of the library inherits.

The two are kept separate below because they're verified differently: the
library's guarantees are enforced by the automated test suite that runs on
every PR; the demo/editor's are implemented and manually confirmed present
in the current code, but are not (yet) covered by an automated accessibility
check of their own.

## Library output: SVG accessible names

**Guarantee:** every SVG `zombie-mermaid` renders — for every diagram type
this library supports (flowchart, state diagram, sequence, class, ER, XY
chart), with or without a `click`-based interactive link, with or without an
explicit `title`/`decorative` option — has a root `<svg>` that follows the
WAI-ARIA `img` accessible-name pattern rather than being an anonymous,
unlabeled group of child text nodes:

| Situation                                                        | Root `<svg>` gets                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `click`-based link on the diagram, `title` not supplied       | `role="img"` (present, but with no claimed name — this library won't fabricate a description)                                                                                                                                                                                                                                                                                                        |
| No `click`-based link, `title: '...'` supplied                   | `role="img"` + `aria-labelledby` pointing at a `<title id>` child holding the escaped text                                                                                                                                                                                                                                                                                                           |
| No `click`-based link, `decorative: true`                        | `aria-hidden="true"`, no `role`, no name                                                                                                                                                                                                                                                                                                                                                             |
| Any node has a `click A "url"` link (real, focusable `<a href>`) | No `role` and no `aria-hidden` at all — both would hide the focusable link from assistive tech while leaving it Tab-reachable, an explicit WAI-ARIA violation. `title`, if supplied, still applies via `aria-labelledby` (a `role`-less element can still have a computed name). `decorative` is silently overridden — a diagram containing a real action is never fully hidden from assistive tech. |

This maps to two WCAG success criteria:

- **[1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html) (Level A):**
  when a consumer supplies `title`, the rendered SVG carries a real
  programmatically-associated text alternative. `zombie-mermaid` cannot
  satisfy 1.1.1 on its own when no `title` is given — a library has no way
  to author a meaningful description of diagram content it didn't create —
  so the honest claim is: _the mechanism is always present and correctly
  wired when a consumer uses it_, not that every rendered SVG is compliant
  regardless of caller input.
- **[4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html) (Level A):**
  the root always has a determinable role (`img`, or none when a focusable
  child needs to remain reachable) rather than an ambiguous default, and a
  `click`-based link keeps its native `<a>` name/role/state instead of being
  masked by an ancestor's `role="img"`.

**Enforced by:** `src/__tests__/svg-accessible-name-conformance.test.ts`
(added for [#294](https://github.com/dfadler/zombie-mermaid/issues/294)),
which renders one real sample per `DiagramType` — a closed TypeScript union
— plus a `stateDiagram-v2` sample, through every `title`/`decorative`
combination (including `title` + `decorative` together, to confirm `title`
is ignored when `decorative` is set), and asserts the table above. It also
asserts a separate matrix for the one diagram type — flowchart — that
currently supports `click`-based links; `stateDiagram-v2` looks like a
candidate but does not actually support `click` links yet (a `click` line
inside a `stateDiagram-v2` block is silently ignored by the parser today),
so it's intentionally excluded from that matrix rather than asserted on
assumption. This runs in the same Vitest suite as every other test
(`pnpm test`), which CI runs on every PR — a regression here fails the
build, not just a review.
It complements the longer-standing
`src/__tests__/svg-accessible-name.test.ts` (from
[#215](https://github.com/dfadler/zombie-mermaid/issues/215) and
[#239](https://github.com/dfadler/zombie-mermaid/issues/239)), which tests
the underlying `svgOpenTag()` unit behavior in more depth. Because the new
test's sample map is typed `Record<DiagramType, string>`, a 6th diagram type
added without a matching sample fails `tsc --noEmit` (the `typecheck` job)
— coverage can't silently lapse the way an unmaintained list of ad hoc test
cases could.

**Not covered:** the _content_ of a supplied `title` — whether it's a good
description is entirely up to the caller. ASCII output
(`renderMermaidASCII`) has no accessible-name concept to speak of: it's
plain text, and plain text read by a screen reader or braille display is
already its own text alternative.

## Library output: focusable interactive links

**Guarantee:** a `click A "url"` link always renders as a real `<a href>`
element (never a `<div onclick>`-style construct with no native semantics),
and is never made unreachable or hidden by a `role`/`aria-hidden` on an
ancestor — see the table above and
[#239](https://github.com/dfadler/zombie-mermaid/issues/239).

**Enforced by:** the same conformance test above (the
"with click/interaction directives" describe block), plus
`src/__tests__/svg-accessible-name.test.ts`'s `hasInteractiveLinks` suite,
which includes a direct regression test for the #239 bug this behavior
fixes.

## Demo/editor site: keyboard and focus behavior

The site this repo builds and deploys itself (`demo/`, `editor/`, and the
per-page generators — `index.ts`, `pages.ts`, `blog.ts`, `fork-fixes.ts`,
`dashboard.ts`, `editor.ts` — what
[dfadler.github.io/zombie-mermaid](https://dfadler.github.io/zombie-mermaid/)
serves) is no longer one gallery-plus-editor page: the #590 "Diagram-Native
Showcase" redesign (see
[docs/decisions/react-site-migration-plan.md](decisions/react-site-migration-plan.md))
replaced the old interactive sample gallery (and the "Edit Diagram" dialog
it opened) with six separate page families, each with its own markup and
its own subset of these properties. The bullets below are scoped per family
rather than asserted for the site as a whole, since that's no longer true
of any single one of them:

- **Visible focus indication** — a consistent accent-colored
  `:focus-visible` ring (`a:focus-visible, button:focus-visible { … }`)
  is present on the **Diagrams hub and per-type pages**
  (`diagrams/*.html`, via `demo/styles.css` + `demo/diagram-page.css`,
  concatenated into `diagrams/assets/diagram-page.css` by `pages.ts`) and
  on **Fork fixes** (`fork-fixes.html`, via `demo/fork-fixes.css`) —
  relevant to
  [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) (Level AA)
  on those pages. **Home** (`index.html`), **Blog** (`blog/*.html`), and
  **Dashboard** (`dashboard.html`) — all built on the redesign's shared
  component library (`demo/components/tokens.tsx`, `primitives.tsx`,
  `nav.tsx`, `footer.tsx`) — declare no `:focus-visible` rule of their own
  and fall back to each browser's default outline. **Editor**
  (`editor.html`) sits in between: its new nav/hero/footer chrome has no
  ring either, and the editor tool itself only styles `:focus` (not
  `:focus-visible`) on three specific inputs
  (`editor/css/config-panel.css`, `font-picker.css`, `color-picker.css`),
  not as a general control ring.
- **A skip-to-content link** — exists only on **Home**:
  `<a className="skip-link" href="#main">` in
  `demo/components/index-page.tsx`, jumping to `<main id="main">` on that
  same page — relevant to
  [2.4.1 Bypass Blocks](https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html) (Level A)
  on Home only. No other page family (Diagrams, Editor, Fork fixes, Blog,
  Dashboard) has one. The Diagrams per-type pages do link a "See all
  samples" CTA to `../#samples-heading`, but that id no longer exists on
  Home (or anywhere) since the redesign — a dead in-page anchor, not a
  functioning skip link.
- **Modal dialog semantics** — **no longer applicable.** The "Edit Diagram"
  dialog this bullet used to describe was part of the interactive gallery
  the redesign removed; there is no `role="dialog"`/`aria-modal` element
  anywhere in the current site. The nearest equivalent workflow today —
  opening a diagram in the live editor — navigates to `editor.html`
  instead of opening an in-page dialog, so this WCAG concern doesn't arise
  the same way.
- **Disclosure-widget state** — the theme picker's "more themes" toggle
  (`#theme-more-btn`, `aria-haspopup`/`aria-expanded`, in
  `demo/components/theme-picker.tsx`, wired by
  `demo/components/theme-bar-client.ts`) sets `aria-expanded` to reflect
  open/closed state, but only on the **Diagrams per-type pages** — the hub
  page renders no theme picker, and the editor's own theme dropdown
  (`#theme-dropdown-btn` in `demo/components/editor-topbar.tsx`, wired by
  `editor/js/init.js`) sets no `aria-expanded` at all. The **mobile
  sidebar toggle** this bullet used to describe no longer exists in any
  form: `demo/components/nav.tsx`'s own header comment states the redesign
  ships no hamburger, drawer, or overflow affordance for its nav — below
  900px the nav links are simply `display:none`, with no toggle and no
  alternate route to them from the nav bar itself (Home's footer and
  in-page sections still link to Diagrams/Editor/Fork fixes/Blog, so
  they're not entirely unreachable on mobile, just not from the nav).

**Verified how:** read directly in the current source (file/selector cited
above) as part of writing this statement's 2026-09-09 revision, cross-checked
against `pnpm run build:site`'s actual output. The properties that predate
the #590 redesign each landed as their own targeted PR (see
`.changeset/consistent-focus-visible-ring.md`,
`.changeset/skip-to-content-link.md`, `.changeset/edit-dialog-aria-labels.md`,
`.changeset/theme-picker-aria-expanded.md` for the change each one made) —
those changesets describe the pre-redesign gallery this section used to
cover, not the current per-family scoping above.
**Not covered:** none of this is exercised by an automated accessibility
check today — no `axe-core`/`pa11y` (or similar) run in CI against any of
the six page families, and no automated keyboard-navigation test walks any
of them. Marking these "implemented" rather than "conformant": where a
property is present, it's the correct markup for its WCAG criterion, but
nothing currently re-verifies it on every PR the way the SVG accessible-name
check does. A demo-site accessibility CI check is a reasonable follow-up,
not something this statement claims already exists.

## What this statement does not claim

- **No WCAG conformance level (A/AA/AAA) for the demo/editor site as a
  whole.** The items above are true, verified properties of specific
  components — not the result of a full page-level audit.
- **No color-contrast guarantee across all 15 built-in themes.** Some
  contrast issues have been found and fixed as one-off reports (see
  `.changeset/description-text-contrast.md`, `.changeset/fix-edit-btn-contrast.md`),
  but no automated contrast check runs across the full theme set, so this
  isn't a standing guarantee the way the SVG accessible-name check is.
- **No screen-reader compatibility testing matrix.** The markup follows
  documented WAI-ARIA/SVG accessibility techniques (cited above), but this
  hasn't been manually verified against a specific screen reader (VoiceOver,
  NVDA, JAWS) and browser combination.

## Reporting a gap

This statement will drift from reality as the codebase changes — a claim
here is only as good as its last review date. If you find rendered output
or demo/editor behavior that contradicts anything above, please
[open an issue](https://github.com/dfadler/zombie-mermaid/issues/new) so it
can be fixed or this document corrected.
