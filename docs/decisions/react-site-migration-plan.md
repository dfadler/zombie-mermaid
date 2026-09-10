# Site generators migrate to React page-by-page, static markup only

## Decision

The site/demo page generators (#423) migrate to React one page at a time,
using static generation only (`renderToStaticMarkup`, no hydration). Full
reasoning for that call, the confirmed page order and per-page risk notes,
and how the bundle-size gate applies are recorded in
[this comment on #423](https://github.com/dfadler/zombie-mermaid/issues/423#issuecomment-5572060726)
rather than duplicated here — this file stays a short pointer plus the
evidence specific to this PR's own change.

Confirmed order: `dashboard.ts` (done) → `editor.ts` (prototyped in #423,
finished in #589) → `index.ts` → `fork-fixes.ts` → `pages.ts` → `blog.ts`
→ `demo/client.ts` (separate, later decision — the only step that would
actually introduce a client-side framework runtime).

**Status: every page generator is migrated as of #589.** `index.ts`,
`editor.ts`, `fork-fixes.ts`, `pages.ts`, and `blog.ts` all render through
`renderToStaticMarkup` now, `demo/site-shell.ts` and the repo-root
`theme-picker.ts` are gone (replaced by `demo/components/site-chrome.tsx`
and `demo/components/theme-picker.tsx`), and `editor/html/*.html` is gone
too. `demo/client.ts` remains a separately bundled vanilla script that the
React shell splices into one `<script type="module">`, exactly as before —
its own migration is out of scope and still undecided.

## Editor.ts prototype (#423)

`editor.ts`'s document shell (`<!DOCTYPE html>`, `<head>`, the outer
`<html>`/`<body>` tags) now renders through
`demo/components/editor-page.tsx` via `renderHtmlDocument()`, reusing
`<SiteHead>` from the dashboard pilot. This is deliberately **not** a full
port: the body's content — the topbar/left-panel/right-panel HTML
fragments (`editor/html/*.html`), the theme dropdown, and the inlined
`<script type="module">` carrying the bundled renderer plus every
`editor/js/*.js` module — is still assembled as one raw string, exactly as
the pre-React generator assembled it, and spliced into
`<body dangerouslySetInnerHTML={{ __html: bodyHtml }} />` unchanged.

This scope was chosen deliberately, not for lack of effort: the fragments
in `editor/html/*.html` are each a single root element
(`.topbar`/`.panel-left`/`.panel-right`) that `body`'s `display: flex`
layout (`editor/css/variables.css`) depends on being direct flex children —
wrapping any one of them in an extra JSX container element to attach
`dangerouslySetInnerHTML` per-fragment would insert an unstyled wrapper
`<div>` as the actual flex item instead, and `.main`'s `flex: 1` rule in
particular relies on being a direct `body` child to fill the remaining
viewport height; getting this right needs the fragments to become real
components (or per-element `dangerouslySetInnerHTML` with the wrapper tag
itself carrying the right class), which is genuinely the bulk of editor.ts's
real port and was intentionally deferred to keep this prototype low-risk.
This hazard is also recorded in the #423 comment above so it isn't a
surprise to rediscover when `editor.ts`'s full port happens.

**What this step proves**, which the dashboard.ts pilot did not have to:
`renderToStaticMarkup` does not corrupt or re-escape a raw `<script>` tag's
content when it arrives via `dangerouslySetInnerHTML` — confirmed both by
a unit test (`__tests__/editor-page.test.ts`, which round-trips body
content containing `<`, `>`, `&`, and quote characters inside a real
`<script>` tag and asserts byte-for-byte survival) and by comparing the
real generator's full output before/after this change.

**Equivalence evidence.** Both the pre-change generator (`editor.ts` at the
commit this branch forked from) and the post-change generator were run
against the real, current `editor/` source tree, and their outputs were
compared with `__tests__/helpers/normalize-html.ts` (deleted in #828 once
the RTL migration it supported was complete) — the same DOM-normalising
helper `dashboard-equivalence.test.ts` used (ignores attribute
order/quoting and whitespace, keeps everything else, including
`<script>`/`<style>` content verbatim). Result: **normalized output is
byte-identical** (`EQUAL: true`). The only differences in the _raw_ output
are the `<head>` region's serialization style (React's
`renderToStaticMarkup` emits attributes without the original's
line-per-attribute formatting, self-closes void elements, and — a known,
already-shipped React quirk visible in `dashboard.html` too — literally
emits `charSet` rather than lowercasing it to `charset`, which HTML parses
identically either way) — none of which change what a browser renders. A
full page-content golden snapshot was **not** checked in as a permanent
test fixture: `editor.html`'s real output embeds a 1.6 MB minified browser
bundle that changes with any `src/**` edit, making a whole-page snapshot
both enormous and constantly invalidated by unrelated changes. The unit
tests in `__tests__/editor-page.test.ts` instead cover the specific,
stable things `<EditorPage>` itself is responsible for.

**Verification run for this change:** `tsc --noEmit` (root + demo), `eslint
.`, `prettier --check .`, and `pnpm test` (157 test files / 3005 tests
passing, 5 pre-existing expected failures, matching the baseline before
this change) are all clean. `pnpm run build:site` succeeds end-to-end
across all six generators. `pnpm run test:visual` (Playwright) has 219
passing specs and a cluster of pre-existing failures in
`svg-samples.visual.test.ts` (dimension mismatches like "Expected an image
174px by 287px, received 175px by 287px" across many unrelated diagram
samples) — confirmed **unrelated to this change** by reverting `editor.ts`
to its pre-change content and re-running the same failing spec, which
fails identically either way. Nothing under `__tests__/visual/` references
`editor.ts`/`editor.html` at all (`ascii-samples.visual.test.ts`,
`svg-samples.visual.test.ts`, and `sidebar-focus.visual.test.ts` all mount
markup/samples directly, never a full generated page), so this suite
cannot regress-test this migration step regardless — its passing subset
(`ascii-samples`, `sidebar-focus`) staying green is the relevant signal
here.

## Finishing the migration (#589)

`index.ts`, `fork-fixes.ts`, `pages.ts`, and `blog.ts` moved to React, and
`editor.ts`'s port was finished: `editor/html/{topbar,left-panel,right-panel}.html`
are now `demo/components/editor-topbar.tsx` and
`demo/components/editor-panels.tsx`, composed by `<EditorPage>` with no
`dangerouslySetInnerHTML` splice around them. The layout hazard the
prototype section above flagged — `.topbar`/`.main`/`.toast` must be direct
`<body>` children and `.panel-left`/`.panel-right` direct `.main` children,
because `editor/css/variables.css` lays both out with flex — is now asserted
directly by `__tests__/editor-page.test.ts` rather than only described here.
`editor/__tests__/support/harness.ts` builds its jsdom document from the
same `<EditorChrome>` component, so the editor's behavioural tests can't
drift from the shipped markup.

Shared chrome came out as components rather than being duplicated five more
times: `demo/components/site-chrome.tsx` (`FontLinks`, `GitHubMarkIcon`,
`SiteHeader`, `ThemeBar`, `Breadcrumb`, `SiteFooter`, `PageShell`,
`StaticPage`) replaces `demo/site-shell.ts`, and
`demo/components/theme-picker.tsx` replaces the repo-root `theme-picker.ts`.
That is deliberately _not_ the shared component library #591 will build —
it's just enough structure that #591 doesn't have to start by pulling five
one-off page implementations apart.

### Equivalence evidence

Every page every generator produces was compared before and after, against
the real source tree, with `__tests__/helpers/normalize-html.ts` (since
deleted — see the note above):
`index.html`, `editor.html`, `fork-fixes.html`, the seven `diagrams/*.html`,
the twelve `blog/*.html`, plus `sitemap.xml`, `blog/feed.xml`, and both
copied asset files. **All 27 artifacts matched** — the five non-HTML ones
byte-for-byte, and 21 of the 22 HTML pages DOM-identical under strict
normalisation.

The one exception is `index.html`, which is DOM-identical except for the
order of two `<head>` children: React 19 hoists `<link rel="preconnect">`
ahead of the `<script type="application/ld+json">` and the Plausible
`<script defer>` that used to precede them. Nothing about that changes what
renders — a preconnect is a resource hint, JSON-LD is inert data, and the
one order that _does_ matter, the font stylesheet `<link>` before the
page's own `<style>`, is preserved. `normalizeHtml`'s `unorderedHead`
option exists for exactly this case.

That comparison was a one-time check, not a permanent test, for the reason
the editor prototype already gave: `index.html` and `editor.html` each
embed a ~1.6 MB minified bundle, and the fork-fixes and diagram pages embed
freshly rendered SVG, so whole-page fixtures would be enormous and
invalidated by any unrelated `src/**` edit. The permanent half is
`__tests__/site-equivalence.test.ts`, which renders each page over small
fixture inputs covering its branches and compares the DOM-normalised result
against a checked-in golden.

`normalizeHtml` itself gained one fix along the way: it compared `style`
attributes through the CSSOM only for `HTMLElement`, so an inline `<svg>`'s
`style="display: none"` was compared as a raw string and reported a false
difference against React's `display:none`. It now normalises any element
that has a `style` property.
