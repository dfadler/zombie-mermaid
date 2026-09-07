# Site generators migrate to React page-by-page, static markup only

## Decision

The site/demo page generators (#423) migrate to React one page at a time,
using static generation only (`renderToStaticMarkup`, no hydration). Full
reasoning for that call, the confirmed page order and per-page risk notes,
and how the bundle-size gate applies are recorded in
[this comment on #423](https://github.com/dfadler/zombie-mermaid/issues/423#issuecomment-5572060726)
rather than duplicated here — this file stays a short pointer plus the
evidence specific to this PR's own change.

Confirmed order: `dashboard.ts` (done) → `editor.ts` (prototyped in this
PR — document shell only) → `index.ts` → `fork-fixes.ts` → `pages.ts` →
`demo/client.ts` (separate, later decision — the only step that would
actually introduce a client-side framework runtime).

## Editor.ts prototype (this change)

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
compared with `__tests__/helpers/normalize-html.ts` — the same
DOM-normalising helper `dashboard-equivalence.test.ts` uses (ignores
attribute order/quoting and whitespace, keeps everything else, including
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
