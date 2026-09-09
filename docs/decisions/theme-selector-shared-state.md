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
