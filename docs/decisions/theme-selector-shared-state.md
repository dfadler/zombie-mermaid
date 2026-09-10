# Theme selector: shared state module, Default vs `zinc-light`, ASCII preview

Settles the architecture questions [#685](https://github.com/dfadler/zombie-mermaid/issues/685)
raised, ahead of [#686](https://github.com/dfadler/zombie-mermaid/issues/686)–[#690](https://github.com/dfadler/zombie-mermaid/issues/690)
restoring a global theme selector (tracked in [#684](https://github.com/dfadler/zombie-mermaid/issues/684)).
Full context, rationale, and the recovered pre-#590 implementation this
restores are in
[a comment on #685](https://github.com/dfadler/zombie-mermaid/issues/685)
rather than duplicated here.

## Decisions

1. **Shared state module: `demo/theme-state.ts`** (`getTheme()` /
   `setTheme(themeKey)` / `subscribe(listener) => unsubscribe`, plus
   `THEME_STORAGE_KEY`/`DEFAULT_THEME_KEY`). SSR-safe, cross-tab sync via the
   `storage` event, Default encoded as key absence — matching the old
   `demo/client.ts` behavior this restores. Implemented and tested in this
   PR; not wired into any page yet.
2. **"Default" and `zinc-light` stay distinct options** — not collapsed.
   They render identically on a single-diagram page, but on the interactive
   gallery Default means "preserve each sample's own baked-in colors" while
   `zinc-light` forces a uniform override — a real, working feature that
   collapsing would silently remove.
3. **The ASCII terminal-preview keeps its independent fixed palette** — it
   does not follow the restored global picker, restoring the pre-#590
   rationale: a terminal-preview panel should show what ASCII output looks
   like in practice, governed by the viewer's own terminal palette, not by
   whatever theme a web page has selected.

## Consequences

- #686 builds the shared `ThemeBar`/`ThemePicker` component against
  `demo/theme-state.ts`'s `getTheme()`/`setTheme()`/`subscribe()` — no
  direct `localStorage` access in the new component.
- #687 (wiring the component into every page) inherits the Default-vs-
  `zinc-light` distinction as-is; no migration of stored preferences is
  needed.
- #689 (live re-theme + ASCII decision) implements the "keep ASCII fixed"
  branch of its own acceptance criteria, not the "wire it through
  `diagramColorsToAsciiTheme()`" branch.
- #690, whatever page-specific wiring it covers, can treat both decisions
  above as settled rather than re-litigating them.
- Revisiting either decision later is fine, but should happen as an
  explicit amendment to this ADR (mirroring the convention in
  `docs/decisions/no-script-interactivity.md`), not a silent behavior
  change buried in an unrelated PR.

## Amendment (#688): the Editor's preview-pane theme joins the shared state

This ADR's own scope deliberately left the Editor's independent theme
dropdown (`editor.ts`'s `THEME_LABELS`, `editor/js/init.js`'s
`bm-editor-theme` `localStorage` key) unaddressed — #688 is where that
question was actually decided, since it wasn't obvious from #685 alone.

**Decision: reconciled, not kept separate.** The Editor's preview-pane
theme now reads/writes the same shared `mermaid-theme` key via `demo/
theme-state.ts` (bridged onto `window.__themeState` for `editor/js/*.js`'s
plain, non-module scripts — see `demo/editor-theme-state-bridge.ts`),
replacing the separate `bm-editor-theme` key entirely (one-time migration
in `editor/js/init.js`, mirroring #687's `zm-diagram-page-theme`
migration in `demo/diagram-page-client.ts`).

Rationale: "which of the 15 built-in themes to render a diagram with" is
the same concept everywhere on the site — the Editor is not an exception,
it is one more surface that renders a diagram. Unifying that choice across
every page, the Editor included, is the actual point of the #684
restoration, not a side effect to avoid. This does **not** extend to
`bm-editor-dark` (`editor/js/dark-mode.js`), an unrelated IDE-chrome
light/dark toggle with no analog elsewhere on the site — only the diagram
theme choice is shared.

## Amendment (#689): live SVG re-theme scope, and the ASCII decision reaffirmed

#689's acceptance criteria call for the global picker to live-retheme
"every rendered `<svg>` on the current page" and for every #687-wired page
that "actually embeds a diagram or preview" to work. In practice, once
#687 and #688 landed, this required no new wiring:

- **Diagram-type pages** (`pages.ts`'s `DiagramTypePage`) are the only
  #687-wired page with a picker sitting next to a live-rendered diagram,
  and `demo/diagram-page-client.ts`'s `applyThemeToDiagram()` already sets
  every variable `themeCssVariables()`/`themeStyleDeclarations()`
  (`packages/core/src/theme.ts`) can emit — `--bg`, `--fg`, `--line`,
  `--accent`, `--muted`, `--surface`, `--border` — so this criterion was
  already met before #689 opened, unchanged by #687's reconciliation of
  _how_ the pill click reaches that function.
- **Home, the Diagrams hub, the Blog index, and Dashboard** (#687's other
  four pages) render no live Mermaid diagram at all — Home's hero and
  theme-showcase graphics are static illustrations/baked-in swatches, not
  `renderMermaidSVG()` output — so there is nothing on those pages for a
  theme change to re-theme.
- **Fork Fixes is a deliberate exception**, not an oversight: it embeds
  27 real rendered before/after `<svg>` pairs, but each one is generated
  once at build time with a fixed `{ bg: '#ffffff', fg: '#1a1a1a' }`
  (`fork-fixes.ts`'s `renderWith()`) — and critically, a pair's "before"
  half comes from whatever renderer version existed at that historical
  fix commit (`loadRendererBefore()`), which is not guaranteed to emit
  the same CSS custom-property contract `themeCssVariables()` defines
  today. Live-retheming these SVGs would risk silently mis-rendering (or
  simply not retheming) an old "before" render, and would undermine the
  page's actual purpose — a precise, stable historical comparison, not an
  interactive showcase. Fork Fixes's picker (added in #687) exists only
  for cross-page persistence, matching the Diagrams hub/Dashboard.

**The ASCII terminal-preview decision (fixed palette, not following the
picker) has nothing left to wire either**, for a different reason: no
page on the current, #590-redesigned site renders a live ASCII
terminal-preview panel at all. The one that `demo/client.ts` rendered was
removed along with that file (#716) and never replaced. The fixed-palette
decision itself stands as documented above — it now lives on in code only
at `__tests__/visual/helpers/terminal-panel.ts` (the visual-regression
suite's own terminal chrome, the sole surviving consumer), whose header
comment cross-references this ADR so a future implementer restoring a
real panel starts from the right default instead of guessing.

## Amendment: the Editor's diagram theme is scoped back down to the Editor

Amendment (#688) above reconciled the Editor's preview-pane theme into the
shared `mermaid-theme` key, on the rationale that "which of the 15 built-in
themes to render with" is one concept site-wide. In practice this had two
consequences beyond that stated intent, both scoped well past "one more
surface that renders a diagram":

1. **Chrome, not just the diagram, followed the pick.** The Editor's own
   `applyThemeToPage()` (`demo/components/editor-rendering.ts`, née
   `editor/js/rendering.ts`) wrote the selected theme's colors onto
   `document.documentElement`'s `--t-bg`/`--t-fg`/`--t-accent` (plus derived
   shadow variables) — the same `:root` variables `editor/css/variables.css`
   derives the Editor's entire chrome palette from. Every editor stylesheet
   (topbar, both panels, the config/color/font pickers, the export dropdown)
   pulls from that chain, so picking any of the 15 diagram themes reskinned
   the whole tool, not just the rendered `<svg>`.
2. **The pick left the tab.** Because the Editor's theme lived under the
   same `mermaid-theme` key `demo/theme-state.ts` syncs across the `storage`
   event, a theme picked in the Editor changed every other open tab of the
   site (home, blog, dashboard, diagram pages), and a theme picked on any of
   those pages changed the Editor's own diagram back, live, in any open tab.

Neither consequence was itself the stated point of #688 ("the same concept
everywhere") — they were side effects of the mechanism chosen (one shared
`:root` write, one shared `localStorage` key) rather than of the underlying
idea. Decided: **the Editor's diagram theme is local to the Editor again.**

- The Editor's own chrome (`--t-bg`/`--t-fg`/`--t-accent`/etc) is now driven
  solely by its independent light/dark toggle (`bm-editor-dark`, `demo/
editor-dark-mode-state.ts`) via `demo/components/editor-dark-mode.ts`'s
  `applyChromeColorMode()` — never by which diagram theme is selected. The
  diagram theme's colors reach only the rendered `<svg>`, through
  `buildOptions()`/`renderMermaidSVGAsync()` (`demo/components/editor-
rendering.ts`), same as every other themed diagram on the site.
- The Editor's diagram-theme preference is persisted under its own
  `bm-editor-theme` key again (`demo/components/editor-theme.ts`) — the
  exact key #688 retired — with no shared module, no cross-tab `storage`
  listener, and no migration between the two keys. Picking a theme
  elsewhere on the site no longer reaches an open Editor tab, and picking
  one in the Editor no longer reaches anywhere else.
- Every other #687-wired page (home, blog, dashboard, diagram pages, Fork
  Fixes) is unaffected: `demo/theme-state.ts`'s shared `mermaid-theme` key
  and cross-tab sync remain exactly as #685–#690 established them. This
  amendment narrows #688 to the Editor only — it does not revisit whether
  the rest of the site should share a theme preference, only whether the
  Editor's own chrome and tab should be part of that sharing.
