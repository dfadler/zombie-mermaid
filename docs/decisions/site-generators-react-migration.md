# Remaining #423 scope (client-side interactivity) stays vanilla TS, not React

## Context

[#423](https://github.com/dfadler/zombie-mermaid/issues/423) proposed two
things: (1) render the five site/demo page generators — `index.ts`,
`editor.ts`, `dashboard.ts`, `fork-fixes.ts`, `pages.ts` — with React instead
of hand-rolled template-literal HTML, and (2) replace `demo/client.ts`'s
manual DOM wiring with React for client-side interactivity. This document
checks both parts against the code as it exists today and proposes what, if
anything, is left to decide.

### Part 1 is done

All five named generators already render through `react-dom/server`'s
`renderToStaticMarkup`, confirmed by reading each file:

| Generator       | Component tree                                                              | Confirms React SSR                                                                          |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `index.ts`      | `demo/components/index-page.tsx` (`IndexPage`)                              | `renderHtmlDocument(createElement(IndexPage, ...))`                                         |
| `editor.ts`     | `demo/components/editor-page.tsx`, `editor-topbar.tsx`, `editor-panels.tsx` | same pattern; only the inline `<script type="module">` bundle content is still a raw string |
| `dashboard.ts`  | `demo/components/dashboard-page.tsx`                                        | same pattern; this was the migration's pilot                                                |
| `fork-fixes.ts` | `demo/components/fork-fixes-page.tsx`                                       | same pattern                                                                                |
| `pages.ts`      | `demo/components/diagram-page.tsx` (`DiagramTypePage`, `DiagramHubPage`)    | same pattern, called once per diagram type in a loop                                        |

[`docs/decisions/react-site-migration-plan.md`](./react-site-migration-plan.md)
and the full plan recorded in
[the #423 issue comment](https://github.com/dfadler/zombie-mermaid/issues/423#issuecomment-5572060726)
already document this: dashboard.ts piloted the pattern, editor.ts's
document shell was prototyped in PR #560, and PR #589 finished all five
(plus `blog.ts`, not named in #423's title but part of the same site).
Every page is static-generation only — no `hydrateRoot`, no client React
runtime — a deliberate choice recorded in that plan's "no page needs it"
reasoning. `react`/`react-dom` are `devDependencies` only in `package.json`;
nothing under `dist/` (the published package) or any shipped client bundle
imports React.

This part of #423 needs no further decision. It's done.

### Part 2 no longer applies as originally scoped — `demo/client.ts` is gone

#423's second bullet named a specific 1570-line file, `demo/client.ts`, as
the thing to port. That file no longer exists. `demo/` has no `client.ts`
today; `git log --diff-filter=D -- demo/client.ts` shows it was deleted in
`fa2a3ea` (PR #716, "remove orphaned pre-#598 modal-dialog code"). The
`#423` issue comment's own migration-order table anticipated this file
would be tackled _after_ all five generators, "as its own scoped decision"
— but by the time that point was reached, the file itself had already been
removed as dead code, not migrated.

What happened: `demo/client.ts` was the vanilla-JS controller for the old
single-page sample gallery (search/filter, SVG/ASCII toggle, theme
switching, a modal "Edit dialog"). [#598](https://github.com/dfadler/zombie-mermaid/issues/598)
("Redesign: Home page", part of the #590 redesign) replaced that gallery
with a different marketing-page layout and stopped bundling `demo/client.ts`
into `index.ts`'s output. Once nothing imported it, PR #716 deleted the
remaining dead code. Editing now lives in the standalone Editor page, not a
modal — see `docs/decisions/editor-in-repo-module.md`.

So the literal ask in #423's second bullet ("replace `demo/client.ts`'s
manual DOM wiring with React") has no object left to act on. What _does_
still exist, as of this writing, is a smaller and more fragmented set of
vanilla client-side scripts that inherited pieces of that responsibility or
were built fresh for the redesign:

| File                                  | Lines  | Responsibility                                                                                                                                                         |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor/js/*.js` (18 modules)         | ~1,125 | Editor page: live rendering, pan/zoom, config panel, color/font pickers, export, tabs, dark mode. Bundled inline into `editor.html`'s single `<script type="module">`. |
| `demo/diagram-page-client.ts`         | 298    | Per-diagram-type SEO page (`pages.ts`): swaps CSS custom properties on the rendered `<svg>` when a theme pill is clicked.                                              |
| `demo/components/theme-bar-client.ts` | 204    | Shared `ThemeBar`/`ThemePicker` controller (pill selection, "More" dropdown, keyboard nav) used across pages.                                                          |

Total: ~1,627 lines — the same rough order of magnitude as the old
1570-line monolith, but split into three purpose-scoped modules instead of
one file, each carrying an explicit cross-reference comment where it
deliberately mirrors another ("Mirrors `demo/client.ts`'s applyTheme
steps...", "same pattern as `demo/client.ts`") rather than silently
duplicating logic. `editor/js/*.js` is still plain JS files concatenated in
a fixed order (`editor.ts`'s `readJsFiles`), not TypeScript modules with
static imports.

## Decision (recommendation)

**Not worth it right now.** Do not port `editor/js/*.js`,
`demo/diagram-page-client.ts`, or `demo/components/theme-bar-client.ts` to
client-rendered (hydrated) React as part of closing out #423.

Reasoning:

- The problem #423 actually named — one 1570-line file doing ad hoc,
  copy-pasted DOM manipulation for five different concerns at once — has
  already been solved, independently of React, by the #590/#598 redesign
  splitting it into three smaller, single-responsibility modules with
  explicit mirroring comments instead of silent duplication. React isn't
  the only fix for "one big file with duplicated logic," and that fix
  already shipped.
- Every remaining script does direct, narrow DOM patching (toggle a class,
  swap a CSS variable, move `aria-expanded`) against markup React already
  produced server-side. None of them holds meaningfully complex UI state
  that would benefit from a component re-render model — they're closer to
  "progressive enhancement scripts" than "application state machines."
- The static-generation-only decision behind Part 1 was explicit that
  hydration was staying out of scope precisely because "no page needs it"
  and it would add "a whole bug class... for zero functional gain." That
  reasoning applies at least as strongly to these three files, since they
  are the site's _most_ interactive surfaces (the editor, live theme
  switching) — exactly where a hydration mismatch would be most visible in
  the strict pixel-diff visual-regression suite this repo requires (see the
  project `CLAUDE.md`'s zero-unintended-visual-diff convention).

## Trade-offs considered

- **Build complexity.** Hydration needs `hydrateRoot` (React 19,
  `react-dom/client`) and server/client markup parity — React logs (and in
  strict cases errors on) any mismatch between what the server rendered and
  what the client's first render produces. `fork-fixes.ts` and `pages.ts`
  already use `dangerouslySetInnerHTML` to splice raw rendered SVG/ASCII
  content; hydrating around those splices would need care to keep the
  hydrated tree's shape identical to what was actually written to disk,
  which is exactly the class of problem the SSR-only decision in Part 1
  chose not to take on.
- **Bundle/build-time cost.** This is a real, asymmetric cost for this
  repo's two single-file pages. `editor.html` and `index.html` must stay
  self-contained single files (dev-server/devtools convenience — the #423
  issue comment's own reasoning), so any client React runtime would have to
  be inlined into that same file, on top of the ~1.6 MB bundled renderer
  they already embed. This repo's own dependency tree currently has no
  `react-dom` client-runtime build installed to measure directly (`react`
  and `react-dom` are `devDependencies`, used for SSR only), so an exact
  gzip figure isn't quoted here rather than guessed from memory — but the
  runtime is a genuinely new category of weight added purely to hydrate
  markup that already renders correctly without it, for pages where every
  extra kilobyte is felt. `scripts/check-bundle-size.ts`/
  `bundle-size-budget.json` only gate `dist/*.js` (the published package),
  not the site build, so nothing would catch this growth automatically
  either — it would need its own new gate, which is itself more build
  complexity to add.
- **Consistency benefit.** Real but modest given the current state. The
  three remaining scripts already share patterns _deliberately_, via
  explicit "mirrors X" comments reviewed and maintained by hand, not
  organic copy-paste drift. React would enforce sharing structurally
  instead of by convention, which is a genuine improvement in the abstract
  — but the cost of the current convention drifting has no evidence of
  having actually happened yet, unlike the pre-#598 file this issue was
  originally reacting to.
- **Risk of visual regression.** This repo's visual-regression suite
  (`pnpm run test:visual`, Playwright) is a strict pixel-diff suite, and
  the project `CLAUDE.md` requires zero unintended visual diff per change.
  `editor.ts`'s own migration notes in `react-site-migration-plan.md`
  already record that this suite has no coverage of `editor.html`/
  `editor.ts` at all (`ascii-samples`, `svg-samples`, and `sidebar-focus`
  mount markup/samples directly, never a full generated page) — meaning a
  hydration mismatch on the editor page specifically would ship with no
  automated visual signal to catch it, only whatever manual verification a
  PR happens to include. That gap is a reason for _more_ caution here, not
  less.

## Phased plan, if this is revisited later

Nothing here is urgent, but if a genuine product need for reactive client
UI shows up (state that DOM patching can't cleanly express — not just "it
would be nicer to write in JSX"), the lowest-risk path mirrors how Part 1's
migration itself proceeded: smallest and most isolated first, prove the
pattern, then scale.

1. **`demo/components/theme-bar-client.ts` first.** `ThemeBar`/
   `ThemePicker` are already server-rendered React components
   (`theme-picker.tsx`); hydrating only that one subtree (a targeted
   `hydrateRoot` call on the theme bar's DOM node, not the whole document —
   an "islands" approach, not full-page hydration) is the smallest possible
   experiment and the one place a shared component already exists on both
   sides.
2. **Add a hydration-parity visual-regression fixture before step 3.** Mount
   the server-rendered HTML, hydrate it, and pixel-diff before/after —
   proving the specific mechanism (like the editor.ts prototype in PR #560
   proved `renderToStaticMarkup` didn't corrupt a raw `<script>` tag) before
   trusting it on a second component.
3. **`demo/diagram-page-client.ts` next**, once the islands mechanism is
   proven — it's larger and touches an embedded `<svg>`'s live attributes,
   a different risk shape than a theme-pill click handler.
4. **`editor/js/*.js` last, if ever.** It's the largest (~1,125 lines
   across 18 modules), the most behaviorally complex (live rendering,
   pan/zoom, drag-resize, export), and embedded in the one page where a
   regression is both hardest to catch (no visual-regression coverage
   today, per above) and most damaging (the editor is the site's core
   interactive surface). Do not start here.
5. **Never do a big-bang port of all three at once.** Each is independently
   scoped, independently low-urgency, and gains nothing from being bundled
   together — the opposite of what made Part 1's page-by-page approach
   work.

## Consequences

- #423, as filed, is functionally resolved for the migration it names most
  concretely (the five generators). Its second bullet has no remaining
  target to act on (`demo/client.ts` is gone), so there's nothing left to
  "finish" there — only a new, smaller, and lower-urgency question about
  three unrelated-by-file-history scripts, which this document recommends
  leaving vanilla for now.
- No code changes accompany this document. `editor/js/*.js`,
  `demo/diagram-page-client.ts`, and `demo/components/theme-bar-client.ts`
  keep working exactly as they do today.
- If a future page's interactivity genuinely outgrows DOM patching, the
  islands approach in "Phased plan" above is the recommended starting
  point rather than a full-page hydration rewrite — but that's a decision
  for whenever such a need is concrete, not now.

## Open questions

- Should #423 be closed, or retitled to scope only the (now purely
  hypothetical) client-interactivity question? That's a call for whoever
  triages the issue — this document doesn't close it, since the task that
  produced it was explicitly to propose, not resolve.
- Is `editor/js/*.js`'s ~1,125 lines worth decomposing on its own terms —
  e.g. into real TypeScript modules with static imports instead of a
  fixed-order string concatenation read by `editor.ts` — independent of
  whether it's ever ported to React? That's a legitimate, separable
  refactor question this document doesn't attempt to answer.
- If islands-style hydration is pursued later, is `react-dom/client`'s
  `hydrateRoot` the right primitive, or would a lighter-weight
  signals/reactivity approach (no React runtime at all) serve these small,
  narrow-scope scripts better? Left open pending an actual concrete need.
