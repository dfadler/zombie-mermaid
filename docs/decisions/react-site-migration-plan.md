# Site generators migrate to React page-by-page, static markup only

## Context

[#423](https://github.com/dfadler/zombie-mermaid/issues/423) proposes moving
the site/demo page generators — `index.ts` (605 lines), `editor.ts` (214
lines), `dashboard.ts`, `fork-fixes.ts` (369 lines), and `pages.ts` (318
lines) — off hand-rolled template-literal HTML and onto React, plus
replacing `demo/client.ts`'s (1574 lines) vanilla DOM manipulation with
React for client-side interactivity. The published library (`src/**`,
`dist/**`) is explicitly out of scope and stays framework-agnostic; this is
site/demo tooling only. The issue leaves three open questions:

1. Static generation (`renderToStaticMarkup`) vs. hydration.
2. Full migration in one pass vs. page-by-page, and if page-by-page, what
   order.
3. Whether the existing bundle-size tooling (`check:bundle-size`,
   `badge:bundle-size`) covers the site build, and whether it matters here.

`dashboard.ts` has already been migrated (see its own header comment and
`demo/components/dashboard-page.tsx`) as the pilot for this issue, proving
the core pattern works: a `demo/<page>-model.ts` (pure data + parsing/
formatting, no JSX) feeds a `demo/components/<page>.tsx` function-component
tree, rendered through `demo/render-html.ts`'s `renderHtmlDocument()`
(`renderToStaticMarkup` + a `<!DOCTYPE html>\n` prefix), with the root
generator script shrinking to an I/O shell. `demo/components/site-head.tsx`
(`<SiteHead>`) is the shared `<head>` component the pilot introduced for
every page to reuse. This plan covers the remaining four generators plus
`demo/client.ts`, informed by a second migration step already done as part
of this work: porting `editor.ts`'s document shell (see "Editor.ts
prototype" below).

## Decision

### 1. Static generation, not hydration

Every page stays `renderToStaticMarkup`-only. No page hydrates on the
client (`hydrateRoot`) today, and none should as part of this migration.
Reasoning:

- **No page needs it.** Every generator's interactivity already comes from
  a separately bundled vanilla script (`src/browser.ts` for `editor.ts`,
  `demo/client.ts` for `index.ts`, `demo/diagram-page-client.ts` for
  `pages.ts`; `fork-fixes.ts` and `dashboard.ts` have none). Introducing
  hydration would add a whole bug class (hydration mismatches between
  server- and client-rendered trees) and real bundle weight for zero
  functional gain — #423 asks for reuse/testability of the _markup_, not a
  client framework runtime.
- **The "single self-contained HTML file" constraint is real for two
  pages, but isn't a hydration argument either way.** `editor.ts` and
  `index.ts` inline their entire browser bundle plus a small hand-written
  JS module list into one `<script type="module">` tag so the page works
  as a single downloaded file. That constraint is about _how the existing,
  unchanged vanilla client script gets delivered_, not about whether React
  renders on the client. It is satisfied today by `dangerouslySetInnerHTML`
  on a raw content region (see the editor.ts prototype below) and stays
  satisfied under the same approach for the remaining pages — no need to
  relax it, and no need for hydration to preserve it.
- **`build:site`'s multi-file output for `pages.ts` (and the `diagrams/`
  tree, `blog/`) already contradicts a strict "must be one file" reading**
  of the constraint — Pages serves an arbitrary file tree fine, and
  `build:site` already moves such a tree today. The self-contained-_file_
  requirement genuinely applies to `editor.html` and `index.html`
  specifically (dev-server/devtools convenience — open the file, get the
  whole page), not to the site as a whole. Static generation preserves
  that per-file property regardless; hydration would not change it.

### 2. Page-by-page, in this order

Confirmed order, continuing from the completed `dashboard.ts` pilot:

| Order | Page             | Status                                                          | Why here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `dashboard.ts`   | **Done** (pilot)                                                | Data-driven markup, no raw-HTML/script splicing, single-file output — established the base pattern with the least incidental risk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2     | `editor.ts`      | **Prototyped in this change** (document shell only — see below) | Smallest remaining page by line count (214), and the first to need `dangerouslySetInnerHTML` for a raw `<script type="module">` region — proving that specific mechanism before the two pages that need it _and_ raw-content splicing together.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3     | `index.ts`       | Not started                                                     | Same inline-script mechanism as editor.ts, now proven; largest page (605 lines) with real extractable logic (JSON-LD, Shiki highlighting, sidebar/category data) worth its own `demo/index-model.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4     | `fork-fixes.ts`  | Not started                                                     | Introduces `dangerouslySetInnerHTML` for real rendered _content_ (ASCII via `asciiToHtml()`, spliced into `<pre class="fix-ascii">`; raw SVG from `renderMermaidSVG`/`renderMermaidSync`), not just a script tag — a materially different risk from editor.ts's, better tackled once the inline-script pattern is old news.                                                                                                                                                                                                                                                                                                                                                                   |
| 5     | `pages.ts`       | Not started                                                     | Structurally distinct: one run emits N per-diagram-type pages plus a hub page, `sitemap.xml`, and asset files — "render the same component with different props in a loop" rather than one `renderHtmlDocument()` call. Already has its own shell abstraction (`demo/site-shell.ts`'s `renderShell`/`pageHtml`) that should be reconciled with `<SiteHead>` during this port, not before — doing it last means `<SiteHead>` will have absorbed whatever the other three ports need first. Also splices `renderMermaidSVG` output and Shiki-highlighted source raw (already flagged with a `nosemgrep` review comment as a reviewed injection point) — same category of risk as fork-fixes.ts. |
| 6     | `demo/client.ts` | Not started, separate decision                                  | Not a page generator — it's the vanilla client-side script every static page still loads for interactivity. Porting _this_ to React is the part of #423 that would actually introduce a client runtime and hydration-shaped concerns (state, event handling, re-render on theme change). Do this only after all five generators are ported and only as its own scoped decision — bundling it into a page port risks conflating "move markup to React" (this plan) with "add a client framework runtime" (a materially bigger, separate call #423's own hydration question already flags as open).                                                                                             |

### 3. Bundle-size tooling does not cover the site build — and that's fine

`scripts/check-bundle-size.ts` and `bundle-size-budget.json` gate only
`dist/*.js`/`dist/*.cjs` — the **published package's** build output
(`pnpm run build` via `vite.config.lib.ts`). They do not run against
`build:site` and have no configuration entry for `editor.html`,
`index.html`, or anything under `site/`. This was true before #423 and
remains true after the dashboard.ts pilot and the editor.ts prototype:
`react`/`react-dom` are `devDependencies` only (confirmed in
`package.json` and via `grep -rl react dist/*` finding no matches after
`pnpm run build`), so the published package's bundle size is categorically
unaffected by this migration — there is nothing new for the existing gate
to check, and extending it to cover the site build is out of scope for
#423 (the issue's own framing already treats site bundle size as "a much
softer constraint," not a gate to add).

### Editor.ts prototype (this change)

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

## Consequences

- The three open questions in #423 are answered: static generation only
  (no hydration, ever, for these five pages — porting `demo/client.ts` to
  React is a separate future decision, not folded into "port the
  generators"), page-by-page in the order above, and the bundle-size gate
  is confirmed scoped to the published package only — no action needed
  there for this issue.
- `editor.ts`'s full port (turning `editor/html/*.html` into real
  components, and the inline `<script>` into a real
  `<script dangerouslySetInnerHTML>` JSX element rather than one raw body
  blob) remains open work, now de-risked at the document-shell level. The
  flex-layout hazard described above is the concrete thing to solve first
  when that port happens — not a surprise to rediscover.
- `index.ts` should reuse `<SiteHead>` and the same
  `dangerouslySetInnerHTML`-for-a-script-region pattern proven here rather
  than re-deriving either.
- `fork-fixes.ts` and `pages.ts` are the first two pages where
  `dangerouslySetInnerHTML` carries real rendered _content_ (ASCII/SVG),
  not just a script tag — each such call site needs the same reviewed-
  injection-point treatment `pages.ts` already gives its raw splices (a
  `nosemgrep` comment), carried into the JSX call site rather than dropped
  as an apparent oversight.
- `pages.ts`'s own shell abstraction (`demo/site-shell.ts`) should be
  reconciled with (folded into, or replaced by) `<SiteHead>` when `pages.ts`
  is ported, not before — deferring that reconciliation to `pages.ts`'s own
  turn means `<SiteHead>` will already reflect whatever the three earlier
  ports needed.
- Porting `demo/client.ts` to React is explicitly not authorized by this
  plan as part of any of the five page ports above; it needs its own scoped
  proposal once all five are done, since it is the one piece of this
  migration that actually introduces a client-side framework runtime.
