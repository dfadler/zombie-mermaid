# Theme selector: shared state module, Default vs `zinc-light`, ASCII preview

## Context

Before the #590 site redesign, a global theme selector
(`GalleryThemeBar`/`ThemePicker`, in the now-deleted `demo/client.ts` —
recovered for this decision via
`git show fa2a3ea48dc84a3d0d1ea1c058ded01401af140c^:demo/client.ts`) let a
visitor pick a theme once and have it apply everywhere. #590 replaced the
home page with a decorative-only `ThemeShowcase` and never gave it a real
picker, leaving theme controls fragmented: the per-diagram-type pages
(`pages.ts` / `demo/diagram-page-client.ts`) keep a page-scoped
`ThemePicker`, the editor (`editor.ts`) has its own independent duplicate
dropdown, and home/blog/hub/fork-fixes/dashboard have none. Each surface
that does have a picker reads/writes `localStorage['mermaid-theme']`
directly, by convention, with no shared code enforcing that convention.

[#684](https://github.com/dfadler/zombie-mermaid/issues/684) tracks
restoring the global selector, split into six sub-issues (#685–#690). This
issue (#685) is the first: settle the architecture the rest build on, before
#686 builds the shared `ThemeBar`/`ThemePicker` component and #687–#690 wire
it into every page and into live diagram re-theming.

Three concrete questions needed answers before any of that could start:

1. What does the shared theme-state module look like?
2. Does the "Default" pseudo-theme (the `''` sentinel) stay a distinct
   option from `zinc-light`, or collapse into an alias for it?
3. Does the ASCII terminal-preview panel follow the restored global picker,
   or keep its independent fixed palette?

## Decision

### 1. Shared state module: `demo/theme-state.ts`

A small module owning the storage key, the read/write, and a
subscribe/notify mechanism — `getTheme()`, `setTheme(themeKey)`,
`subscribe(listener) => unsubscribe`, plus the `THEME_STORAGE_KEY` and
`DEFAULT_THEME_KEY` constants. Every future page-client and the shared
`ThemeBar`/`ThemePicker` component (#686) should go through this module
instead of touching `localStorage['mermaid-theme']` directly.

Notable properties:

- **SSR-safe.** The site's page generators (`index.ts`, `pages.ts`,
  `editor.ts`, `blog.ts`, `dashboard.ts`, `fork-fixes.ts`) run under Node via
  `tsx`, not a browser — there is no `window`/`localStorage` at generation
  time. Every exported function detects this (`typeof window === 'undefined'`,
  plus a `try`/`catch` since some browsers throw just _accessing_
  `localStorage` in restricted contexts, e.g. Safari private mode) and
  degrades to a safe default (`getTheme()` returns `DEFAULT_THEME_KEY`,
  `setTheme()` still notifies in-process subscribers but skips persistence,
  `subscribe()` still works). Nothing needs a separate SSR guard at the call
  site.
- **Cross-tab sync via the `storage` event.** The browser fires `storage`
  on every _other_ browsing context sharing an origin when one of them
  writes to `localStorage`, but never on the writer itself. The module
  registers one listener for this at module scope and re-notifies its own
  subscribers, so a theme picked on one open tab/page propagates to others
  without a reload — extending same-tab behavior the old `demo/client.ts`
  already had (subscribers notified synchronously on every `setTheme()`
  call) to also cover the multi-tab case it never handled.
- **Default is an absence, not a value**, matching every prior
  implementation: `setTheme('')` calls `localStorage.removeItem`, not
  `setItem(key, '')`. `getTheme()` collapses "never set" and "explicitly
  Default" into the same returned `''`, since they're already
  indistinguishable to every reader of the stored preference.

The module is implemented and tested in this PR
(`demo/theme-state.ts`, `__tests__/demo-theme-state.test.ts` for
browser/jsdom behavior, `__tests__/demo-theme-state-ssr.test.ts` for the
no-`window` contract) but is **not wired into any page yet** — #686 owns
building the shared `ThemeBar`/`ThemePicker` component against it, and
#687 owns actually mounting that component on every page.

### 2. "Default" and `zinc-light` stay distinct options

They are not collapsed. `zinc-light`'s colors
(`packages/core/src/theme.ts`: `{ bg: '#FFFFFF', fg: '#27272A' }`) are
byte-identical to `demo/components/theme-picker.tsx`'s `DEFAULT_SWATCH`, so
the two pills render identically almost everywhere — but "almost" is load
bearing. `theme-picker.tsx`'s own header comment documents a real semantic
difference between the two surfaces that use it:

- On the interactive gallery (`index.ts`), **Default means "no override —
  keep whatever colors each individual sample already has baked in."**
  Samples can differ from each other and from `zinc-light` (a Mermaid
  source with its own `classDef`/style directives keeps them). Only
  explicitly picking `zinc-light` forces every sample to the same uniform
  palette.
- On a single-diagram page (`pages.ts`), there is only one diagram and no
  per-sample baked-in styling to preserve, so Default and `zinc-light`
  genuinely do render the same thing there.

Collapsing them into one option would be correct for the second case and
silently wrong for the first — it would remove the interactive gallery's
"preserve each sample's authored look" mode entirely, which is a real,
currently-working feature, not an accidental side effect. Keeping them
distinct also avoids a `localStorage` migration: today, "never touched the
picker" and "explicitly chose Default" are both the _absence_ of a stored
key; aliasing Default to `zinc-light` would force a decision about whether
picking "Default" should now write `'zinc-light'` to storage (behavior
change for every returning visitor) or keep the absence-based encoding
under a different displayed label (no actual simplification, just renamed
complexity).

**Consequence for #686:** the shared `ThemePicker`/`ThemeBar` component
keeps rendering both pills (already true of
`demo/components/theme-picker.tsx`'s `ThemePicker`, unchanged by this
decision) and keeps passing `''` through `theme-state.ts` as Default's
sentinel, not `'zinc-light'`.

### 3. ASCII terminal-preview keeps its independent fixed palette

The mock-terminal preview shown alongside a rendered SVG sample continues
to ignore the page's theme picker. This restores the pre-#590 behavior
exactly: the deleted `demo/client.ts` used a fixed `TERMINAL_PALETTE`,
independent of `applyTheme`, with the rationale recorded in its own
comment: _"real terminal output doesn't retheme itself when you change your
editor's color scheme."_ That reasoning still holds — a terminal-preview
panel is meant to show what the diagram looks like as ASCII/terminal
output, which in real use is governed by the _viewer's terminal palette_,
not by whatever theme a web page happens to have selected. Re-theming it
to follow the picker would make the preview lie about what ASCII output
actually looks like in practice (a single fixed appearance regardless of
the surrounding terminal's colorscheme).

**Consequence for #689 (live re-theme of diagrams):** when wiring the
restored global picker to re-theme rendered SVGs live via
`themeCssVariables()`, the ASCII terminal-preview panel is explicitly
excluded from that re-theme pass. #689 should keep a fixed palette
constant (mirroring the old `TERMINAL_PALETTE`) and add a code comment at
that call site referencing this ADR, so the exclusion reads as intentional
rather than an oversight next time someone touches that code.

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
- Revisiting either the Default/`zinc-light` or the ASCII-preview decision
  later is fine, but should happen as an explicit amendment to this ADR
  (mirroring the convention in `docs/decisions/no-script-interactivity.md`),
  not a silent behavior change buried in an unrelated PR.
